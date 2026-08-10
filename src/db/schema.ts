import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const pkg = sqliteTable(
  "package",
  {
    did: text("author_did").notNull(),
    rkey: text("uri").notNull(),
    cursor: integer(),
    createdAt: text("created_at").notNull(),
    indexedAt: text("indexed_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("package_idx").on(table.did, table.rkey),
    unique("package_unique_idx").on(table.did, table.rkey),
  ],
);

export const stage = sqliteTable(
  "stage",
  {
    did: text("author_did").notNull(),
    rkey: text("uri").notNull(),
    cursor: integer(),
    createdAt: text("created_at").notNull(),
    indexedAt: text("indexed_at"),
  },
  (table) => [
    index("stage_idx").on(table.did, table.rkey),
    unique("stage_unique_idx").on(table.did, table.rkey),
  ],
);
