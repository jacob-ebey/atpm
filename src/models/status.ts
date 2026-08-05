import { desc, eq } from "drizzle-orm";
import { getContext } from "hono/context-storage";
import * as v from "valibot";

import * as s from "@/db/schema";
import { XyzStatusphereStatus } from "@/lexicons";
import { defineCreateRecord } from "@/lib/model";

const CreateStatusSchema = v.object({
  authorDid: v.string(),
  status: v.string(),
});

export const createStatus = defineCreateRecord(
  CreateStatusSchema,
  XyzStatusphereStatus.mainSchema,
  ({ status }) =>
    ({ $type: "xyz.statusphere.status", createdAt: new Date().toISOString(), status }) as const,
  async ({ db, session }, created) => {
    const [output] = await db
      .insert(s.status)
      .values({
        authorDid: session.did,
        createdAt: created.record.createdAt,
        status: created.record.status,
        indexedAt: created.record.createdAt,
        uri: created.uri,
      })
      .returning();
    return output as s.StatusRow | undefined;
  },
);

export async function readUserStatus(userDid: string) {
  const c = getContext();
  const db = c.get("db");

  const [status] = await db
    .select()
    .from(s.status)
    .where(() => eq(s.status.authorDid, userDid))
    .orderBy(desc(s.status.createdAt))
    .limit(1);

  return status as s.StatusRow | undefined;
}
