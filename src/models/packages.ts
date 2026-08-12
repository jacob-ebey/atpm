import {
  ComAtprotoRepoApplyWrites,
  ComAtprotoRepoDeleteRecord,
  ComAtprotoRepoGetRecord,
  ComAtprotoRepoListRecords,
  ComAtprotoRepoPutRecord,
} from "@atcute/atproto";
import { is, parseResourceUri, safeParse, type Did, type ResourceUri } from "@atcute/lexicons";
import { and, count, eq, like, max, sql } from "drizzle-orm";
import { getContext } from "hono/context-storage";
import { v5 as uuid } from "uuid";
import * as v from "valibot";

import * as s from "@/db/schema";
import {
  DevAtpmAlphaPackage as DevAtpmPackage,
  DevAtpmAlphaStage as DevAtpmStage,
  DevAtpmAlphaTrustPublisher as DevAtpmTrustPublisher,
} from "@/lexicons";
import { invariant } from "@/lib/invariant";

const FIRST_EVENT = 1786224527583480;

const IndexEventSchema = v.object({
  type: v.union([v.literal("create"), v.literal("update"), v.literal("delete")]),
  collection: v.union([v.literal("dev.atpm.alpha.package"), v.literal("dev.atpm.alpha.stage")]),
  did: v.string(),
  rkey: v.string(),
  cursor: v.number(),
});

export async function readPackage(did: Did, rkey: string) {
  const c = getContext();
  const atcute = c.get("atcute");

  const client = await atcute.publicClientFor(did);

  const record = await client.call(ComAtprotoRepoGetRecord, {
    params: {
      repo: did as Did,
      rkey,
      collection: "dev.atpm.alpha.package",
    },
  });

  if (!record.ok) return undefined;

  return record.data.value as DevAtpmPackage.Main;
}

export async function readRecentPackages() {
  const c = getContext();
  const db = c.get("db");
  return await db
    .select({
      createdAt: s.pkg.createdAt,
      indexedAt: s.pkg.indexedAt,
      did: s.pkg.did,
      rkey: s.pkg.rkey,
    })
    .from(s.pkg)
    .orderBy(sql`COALESCE(${s.pkg.indexedAt}, ${s.pkg.createdAt})`)
    .limit(10);
}

export async function estimateStagedPackages() {
  const c = getContext();
  const atcute = c.get("atcute");
  const db = c.get("db");
  if (!atcute.session) return 0;

  return await db
    .select({
      count: count(),
    })
    .from(s.stage)
    .where(eq(s.stage.did, atcute.session.did))
    .then(([r]) => r?.count ?? 0);
}

export async function readStagedPackages() {
  const c = getContext();
  const atcute = c.get("atcute");

  invariant(atcute.authenticated);

  const results: (DevAtpmStage.Main & { cid: string; uri: ResourceUri })[] = [];

  let cursor: string | undefined;
  do {
    const result = await atcute.client.call(ComAtprotoRepoListRecords, {
      params: {
        repo: atcute.session.did,
        collection: "dev.atpm.alpha.stage",
        limit: 100,
        cursor,
      },
    });
    if (!result.ok) {
      break;
    }
    cursor = result.data.cursor;
    results.push(
      ...result.data.records.map((record) => ({
        ...(record.value as DevAtpmStage.Main),
        cid: record.cid,
        uri: record.uri,
      })),
    );
  } while (cursor);

  return results;
}

export async function searchPackages(query: string) {
  const c = getContext();
  const db = c.get("db");
  return await db
    .select({
      createdAt: s.pkg.createdAt,
      indexedAt: s.pkg.indexedAt,
      did: s.pkg.did,
      rkey: s.pkg.rkey,
    })
    .from(s.pkg)
    .where(like(s.pkg.rkey, `${query}%`));
}

export async function readCursor() {
  const c = getContext();
  const db = c.get("db");
  const [results] = await db
    .select({
      pkgCursor: max(s.pkg.cursor),
      stageCursor: max(s.stage.cursor),
    })
    .from(s.pkg);

  return Math.max(FIRST_EVENT, results?.pkgCursor ?? 0, results?.stageCursor ?? 0);
}

export async function indexEvent(
  event: v.InferOutput<typeof IndexEventSchema>,
): Promise<{ success: true } | { success?: false | undefined; error: string }> {
  const c = getContext();
  const atcute = c.get("atcute");
  const db = c.get("db");

  const parsed = v.safeParse(IndexEventSchema, event);
  if (!parsed.success) return { error: "invalid event" };

  const [existing] =
    event.collection === "dev.atpm.alpha.package"
      ? await db
          .select({ cursor: s.pkg.cursor })
          .from(s.pkg)
          .where(and(eq(s.pkg.did, event.did), eq(s.pkg.rkey, event.rkey)))
          .limit(1)
      : await db
          .select({ cursor: s.stage.cursor })
          .from(s.stage)
          .where(and(eq(s.stage.did, event.did), eq(s.stage.rkey, event.rkey)))
          .limit(1);

  if (typeof existing?.cursor === "number" && existing.cursor >= event.cursor) {
    return { success: true };
  }

  if (event.type === "delete") {
    try {
      if (event.collection === "dev.atpm.alpha.package") {
        await db.delete(s.pkg).where(and(eq(s.pkg.did, event.did), eq(s.pkg.rkey, event.rkey)));
        return { success: true };
      }
      if (event.collection === "dev.atpm.alpha.stage") {
        await db
          .delete(s.stage)
          .where(and(eq(s.stage.did, event.did), eq(s.stage.rkey, event.rkey)));
        return { success: true };
      }
      return { error: "invalid collection" };
    } catch (error) {
      console.error("failed to sync delete event", error);
      return { error: "failed to sync" };
    }
  }

  const actor = await atcute.actorResolver.resolve(event.did as Did).catch(() => undefined);
  if (!actor) return { error: "actor not found" };

  const atcuteClient = await atcute.publicClientFor(actor.did);

  const record = await atcuteClient
    .call(ComAtprotoRepoGetRecord, {
      params: {
        repo: actor.did,
        collection: event.collection,
        rkey: event.rkey,
      },
    })
    .catch(() => undefined);

  const value = record?.ok ? record?.data.value : undefined;
  if (value) {
    switch (event.collection) {
      case "dev.atpm.alpha.package":
        if (!is(DevAtpmPackage.mainSchema, value)) {
          return { error: "invalid record" };
        }
        break;
      case "dev.atpm.alpha.stage":
        if (!is(DevAtpmStage.mainSchema, value)) {
          return { error: "invalid record" };
        }
        break;
      default:
        return { error: "invalid collection" };
    }
  }

  if (value) {
    switch (parsed.output.collection) {
      case "dev.atpm.alpha.package": {
        const synced = await db
          .insert(s.pkg)
          .values({
            createdAt: value.createdAt,
            did: actor.did,
            rkey: event.rkey,
            cursor: event.cursor,
          })
          .onConflictDoUpdate({
            target: [s.pkg.did, s.pkg.rkey],
            set: {
              cursor: event.cursor,
            },
          })
          .catch(() => undefined);

        if (synced?.success) return { success: true };

        return { error: "failed to sync" };
      }
      case "dev.atpm.alpha.stage": {
        const synced = await db
          .insert(s.stage)
          .values({
            createdAt: value.createdAt,
            did: actor.did,
            rkey: event.rkey,
            cursor: event.cursor,
          })
          .onConflictDoUpdate({
            target: [s.stage.did, s.stage.rkey],
            set: {
              cursor: event.cursor,
            },
          })
          .catch(() => undefined);

        if (synced?.success) return { success: true };

        return { error: "failed to sync" };
      }
      default:
        return { error: "invalid collection" };
    }
  }

  return { success: true };
}

export async function readAllPublishers() {
  const c = getContext();
  const atcute = c.get("atcute");

  invariant(atcute.authenticated);

  const results: (DevAtpmTrustPublisher.Main & { cid: string; uri: ResourceUri })[] = [];

  let cursor: string | undefined;
  do {
    const result = await atcute.client.call(ComAtprotoRepoListRecords, {
      params: {
        repo: atcute.session.did,
        collection: "dev.atpm.alpha.trustPublisher",
        limit: 100,
        cursor,
      },
    });
    if (!result.ok) {
      break;
    }
    cursor = result.data.cursor;
    results.push(
      ...result.data.records.map((record) => ({
        ...(record.value as DevAtpmTrustPublisher.Main),
        cid: record.cid,
        uri: record.uri,
      })),
    );
  } while (cursor);

  return results;
}

export async function readPublishers(did: Did, rkey: string) {
  const c = getContext();
  const atcute = c.get("atcute");

  const client = await atcute.publicClientFor(did);

  const record = await client.call(ComAtprotoRepoGetRecord, {
    params: {
      repo: did,
      collection: "dev.atpm.alpha.trustPublisher",
      rkey,
    },
  });

  if (!record.ok) {
    console.error(record.data);
    return null;
  }

  const validated = safeParse(DevAtpmTrustPublisher.mainSchema, record.data.value);

  if (!validated.ok) return null;

  return validated.value;
}

const CheckboxSchema = v.pipe(
  v.optional(v.union([v.string(), v.boolean()]), false),
  v.transform((input) => input === "on" || input === "true" || input === true),
);

export const CreatePublisherSchema = v.object({
  package: v.string(),
  username: v.string(),
  repository: v.string(),
  workflow: v.string(),
  allowPublish: CheckboxSchema,
  allowStage: CheckboxSchema,
});

export async function createOrUpdatePublisher(
  input: v.InferInput<typeof CreatePublisherSchema>,
): Promise<{ success: true } | { success?: false; error: string }> {
  const c = getContext();
  const atcute = c.get("atcute");
  invariant(atcute.authenticated);

  const parsed = v.safeParse(CreatePublisherSchema, input);
  if (!parsed.success) {
    const issues = v.flatten(parsed.issues);
    const subIssue = Object.entries(issues.nested ?? {}).find(([, e]) => e?.[0]);
    const formatted = subIssue ? `${subIssue[0]}: ${subIssue[1]?.[0] || "unknown error"}` : null;
    return { success: false, error: issues.root?.[0] || formatted || "invalid input" };
  }

  const record: DevAtpmTrustPublisher.Main = {
    $type: "dev.atpm.alpha.trustPublisher",
    createdAt: new Date().toISOString(),
    allowPublish: parsed.output.allowPublish,
    allowStage: parsed.output.allowStage,
    github: {
      repository: parsed.output.repository,
      username: parsed.output.username,
      workflow: parsed.output.workflow,
    },
  };

  const written = await atcute.client.call(ComAtprotoRepoPutRecord, {
    input: {
      repo: atcute.session.did,
      collection: "dev.atpm.alpha.trustPublisher",
      rkey: parsed.output.package,
      record,
    },
  });

  if (!written.ok) {
    return { error: written.data.error };
  }

  return { success: true };
}

export async function deletePublisher(
  rkey: string,
): Promise<{ success: true } | { success?: false; error: string }> {
  const c = getContext();
  const atcute = c.get("atcute");
  invariant(atcute.authenticated);

  const deleted = await atcute.client.call(ComAtprotoRepoDeleteRecord, {
    input: {
      repo: atcute.session.did,
      collection: "dev.atpm.alpha.trustPublisher",
      rkey,
    },
  });

  if (!deleted.ok) {
    return { error: deleted.data.error };
  }

  return { success: true };
}

export async function approveStaged(stageId: string): Promise<
  | {
      success?: false;
      error: string;
      status: number;
    }
  | {
      success: true;
    }
> {
  const c = getContext();
  const atcute = c.get("atcute");
  const db = c.get("db");
  invariant(atcute.authenticated);

  const staged = await readStagedPackages();
  const pkg = staged.find((pkg) => stageId === uuid(pkg.uri + `/${pkg.cid}`, uuid.URL));
  if (!pkg) {
    return {
      error: "Not Found - No staged package version found with the provided ID.",
      status: 404,
    };
  }

  const actor = await atcute.actorResolver.resolve(atcute.session.did).catch(() => null);
  const [scope, name] = pkg.name.split("/");
  if (!scope?.startsWith("@")) return { error: "package name must include @ scope", status: 400 };
  if (!actor || scope.slice(1) !== actor.handle) {
    return { error: "scope does not match actor handle", status: 403 };
  }
  if (atcute.restrictedToPackage && atcute.restrictedToPackage !== name) {
    return { error: "scope does not allow this package name", status: 403 };
  }

  const existingPackage = await atcute.client.call(ComAtprotoRepoGetRecord, {
    params: {
      repo: atcute.session.did,
      collection: "dev.atpm.alpha.package",
      rkey: name,
    },
  });

  const versions: DevAtpmPackage.Package[] = existingPackage?.ok
    ? [...(existingPackage.data.value.versions as DevAtpmPackage.Package[])]
    : [];

  if (versions.some((version) => version.version === pkg.version)) {
    return { error: "version already exists", status: 403 };
  }

  versions.unshift({
    $type: "dev.atpm.alpha.package#package",
    createdAt: new Date().toISOString(),
    version: pkg.version,
    blob: pkg.blob,
    meta: pkg.meta,
  });

  const record: DevAtpmPackage.Main = {
    $type: "dev.atpm.alpha.package",
    createdAt: new Date().toISOString(),
    tags: {
      ...(existingPackage.ok
        ? (existingPackage.data.value as { tags?: Record<string, string> }).tags
        : undefined),
      ...pkg.tags,
    },
    versions,
  };

  const rkey = parseResourceUri(pkg.uri).rkey!;

  const updated = await atcute.client.call(ComAtprotoRepoApplyWrites, {
    input: {
      repo: atcute.session.did,
      writes: [
        existingPackage.ok
          ? {
              $type: "com.atproto.repo.applyWrites#update",
              collection: "dev.atpm.alpha.package",
              rkey: name,
              value: record,
            }
          : {
              $type: "com.atproto.repo.applyWrites#create",
              collection: "dev.atpm.alpha.package",
              rkey: name,
              value: record,
            },
        {
          $type: "com.atproto.repo.applyWrites#delete",
          collection: "dev.atpm.alpha.stage",
          rkey: rkey,
        },
      ],
    },
  });

  if (!updated.ok) return { error: "failed to update record", status: 500 };

  const indexedAt = new Date().toISOString();
  await db
    .insert(s.pkg)
    .values({
      createdAt: record.createdAt,
      did: atcute.session.did,
      rkey: name,
    })
    .onConflictDoUpdate({
      target: [s.pkg.did, s.pkg.rkey],
      set: {
        indexedAt,
      },
    })
    .catch(console.error.bind(console));

  await db.delete(s.stage).where(and(eq(s.stage.did, actor.did), eq(s.stage.rkey, rkey)));

  return { success: true };
}

export async function rejectStaged(stageId: string): Promise<
  | {
      success?: false;
      error: string;
      status: number;
    }
  | {
      success: true;
    }
> {
  const c = getContext();
  const atcute = c.get("atcute");
  const db = c.get("db");
  invariant(atcute.authenticated);

  const staged = await readStagedPackages();
  const pkg = staged.find((pkg) => stageId === uuid(pkg.uri + `/${pkg.cid}`, uuid.URL));
  if (!pkg) {
    return {
      error: "Not Found - No staged package version found with the provided ID.",
      status: 404,
    };
  }

  const uri = parseResourceUri(pkg.uri);
  if (!uri.collection || !uri.rkey) {
    return {
      error: "Not Found - No staged package version found with the provided ID.",
      status: 404,
    };
  }

  await db
    .delete(s.stage)
    .where(and(eq(s.stage.did, atcute.session.did), eq(s.stage.rkey, uri.rkey)));

  const deleted = await atcute.client.call(ComAtprotoRepoDeleteRecord, {
    input: {
      repo: atcute.session.did,
      collection: "dev.atpm.alpha.stage",
      rkey: uri.rkey,
    },
  });
  if (!deleted.ok) {
    return { error: deleted.data.error, status: 500 };
  }

  return { success: true };
}
