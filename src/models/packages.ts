import { ComAtprotoRepoGetRecord, ComAtprotoRepoListRecords } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { is, type Did, type ResourceUri } from "@atcute/lexicons";
import { and, count, eq, like, max, sql } from "drizzle-orm";
import { getContext } from "hono/context-storage";
import * as v from "valibot";

import * as s from "@/db/schema";
import {
  DevAtpmAlphaPackage as DevAtpmPackage,
  DevAtpmAlphaStage as DevAtpmStage,
} from "@/lexicons";
import { invariant } from "@/lib/invariant";
import type { ResolvedActor } from "@atcute/identity-resolver";
import type { OAuthSession } from "@atcute/oauth-node-client";

const FIRST_EVENT = 1786224527583480;

const IndexEventSchema = v.object({
  type: v.union([v.literal("create"), v.literal("update"), v.literal("delete")]),
  collection: v.union([v.literal("dev.atpm.alpha.package"), v.literal("dev.atpm.alpha.stage")]),
  did: v.string(),
  rkey: v.string(),
  cursor: v.number(),
});

export async function readPackage(did: string, rkey: string) {
  const c = getContext();
  const atcute = c.get("atcute");

  const actor = await atcute.actorResolver.resolve(did as Did).catch(() => undefined);

  if (!actor) return undefined;

  const client =
    atcute.client ?? new Client({ handler: simpleFetchHandler({ service: actor.pds }) });

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
  const c = getContext<{
    Variables: {
      actor: ResolvedActor;
      cliSession: OAuthSession;
    };
  }>();
  const atcute = c.get("atcute");
  const cliSession = c.get("cliSession");

  const client = cliSession ? new Client({ handler: cliSession }) : atcute.client;
  const session = cliSession ? cliSession : atcute.session;

  invariant(client);
  invariant(session);

  const results: (DevAtpmStage.Main & { cid: string; uri: ResourceUri })[] = [];

  let cursor: string | undefined;
  do {
    const result = await client.call(ComAtprotoRepoListRecords, {
      params: {
        repo: session.did,
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

  const atcuteClient = new Client({ handler: simpleFetchHandler({ service: actor.pds }) });

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

        if (!synced?.success) return { success: true };

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

        if (!synced?.success) return { success: true };

        return { error: "failed to sync" };
      }
      default:
        return { error: "invalid collection" };
    }
  }

  return { success: true };
}
