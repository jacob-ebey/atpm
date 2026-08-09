import { sql, type Simplify } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const status = sqliteTable(
  "package",
  {
    did: text("author_did").notNull(),
    rkey: text("uri").notNull(),
    cursor: integer(),
    tags: text("tags", { mode: "json" }).notNull(),
    versions: text("versions", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull(),
    indexedAt: text("indexed_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("package_idx").on(table.did, table.rkey),
    unique("unique_idx").on(table.did, table.rkey),
  ],
);

export type StatusRow = Simplify<typeof status.$inferSelect>;
