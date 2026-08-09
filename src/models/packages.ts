import { ComAtprotoRepoGetRecord } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { is, type Did } from "@atcute/lexicons";
import { and, eq, max } from "drizzle-orm";
import { getContext } from "hono/context-storage";
import * as v from "valibot";

import * as s from "@/db/schema";
import { DevAtpmAlphaPackage as DevAtpmPackage } from "@/lexicons";

const FIRST_EVENT = 1786224527583480;

export const IndexEventSchema = v.object({
  type: v.union([v.literal("create"), v.literal("update"), v.literal("delete")]),
  did: v.string(),
  rkey: v.string(),
  cursor: v.number(),
});

export async function getCursor() {
  const c = getContext();
  const db = c.get("db");
  const [results] = await db
    .select({
      cursor: max(s.status.cursor),
    })
    .from(s.status);

  return results?.cursor ?? FIRST_EVENT;
}

export async function indexEvent(event: v.InferOutput<typeof IndexEventSchema>) {
  const c = getContext();
  const atcute = c.get("atcute");
  const db = c.get("db");

  if (event.type === "delete") {
    try {
      await db
        .delete(s.status)
        .where(and(eq(s.status.did, event.did), eq(s.status.rkey, event.rkey)));
      return { success: true };
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
        collection: "dev.atpm.alpha.package",
        rkey: event.rkey,
      },
    })
    .catch(() => undefined);

  if (!record || !record.ok) {
    return { error: "record not found" };
  }

  const value = record.data.value;
  if (!is(DevAtpmPackage.mainSchema, value)) {
    return { error: "invalid record" };
  }

  const [existing] = await db
    .select()
    .from(s.status)
    .where(and(eq(s.status.did, event.did), eq(s.status.rkey, event.rkey)))
    .limit(1);

  if (typeof existing?.cursor === "number" && existing.cursor >= event.cursor) {
    return { success: true };
  }

  const synced = await db
    .insert(s.status)
    .values({
      createdAt: value.createdAt,
      did: actor.did,
      rkey: event.rkey,
      cursor: event.cursor,
      tags: value.tags,
      versions: value.versions,
    })
    .onConflictDoUpdate({
      target: [s.status.did, s.status.rkey],
      set: {
        cursor: event.cursor,
        tags: value.tags,
        versions: value.versions,
      },
    })
    .catch(() => undefined);

  if (synced?.meta.changes) return { success: true };

  return { error: "failed to sync" };
}
