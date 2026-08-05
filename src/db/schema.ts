import { sql, type Simplify } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const status = sqliteTable(
  "status_table",
  {
    uri: text("uri").notNull(),
    authorDid: text("author_did").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    indexedAt: text("indexed_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("author_did_idx").on(table.authorDid)],
);

export type StatusRow = Simplify<typeof status.$inferSelect>;
