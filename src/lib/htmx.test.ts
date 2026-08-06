import { Hono } from "hono";
import { expect, test } from "vite-plus/test";

import { htmxRedirects } from "./htmx";

test("rewrites redirects", async () => {
  const response = await new Hono()
    .get("/", htmxRedirects(), (c) => {
      c.header("test", "value");
      return c.redirect(new URL("/redirected", c.req.url));
    })
    .fetch(
      new Request(new URL("/", "http://test"), {
        headers: {
          "HX-Request": "true",
        },
      }),
    );
  expect(response.status).toBe(204);
  expect(Object.fromEntries(response.headers)).toEqual({
    "hx-redirect": "http://test/redirected",
    test: "value",
  });
});
