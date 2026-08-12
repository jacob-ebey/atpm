import { Hono } from "hono";
import { expect, test } from "vite-plus/test";

import { requireAuth } from "./auth";

function get(session?: boolean, path?: string) {
  return new Hono()
    .get(
      "*",
      (c, next) => {
        c.set("atcute", {
          session: session ? {} : undefined,
        } as any);
        return next();
      },
      requireAuth(),
      (c) => c.text("ok"),
    )
    .fetch(new Request(new URL(path || "/", "http://test")));
}

test("redirects when no atcute session", async () => {
  const response = await get();
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("http://test/auth/login?returnTo=/");
});

test("redirect retains pathname and search", async () => {
  const response = await get(false, "/pathname?search=value");
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("http://test/auth/login?returnTo=/pathname");
});
