import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { MiddlewareHandler } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    db: DrizzleD1Database;
  }
}

export const database = (): MiddlewareHandler => async (c, next) => {
  const db = drizzle(c.env.DB);
  c.set("db", db);
  await next();
};
