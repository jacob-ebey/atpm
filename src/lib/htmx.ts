import type { MiddlewareHandler } from "hono";

export const htmxRedirects = (): MiddlewareHandler => async (c, next) => {
  await next();

  if (c.res.status >= 300 && c.res.status < 400 && c.req.header("hx-request") === "true") {
    const location = c.res.headers.get("location");
    if (!location) return;
    c.res.headers.delete("location");
    c.header("hx-redirect", location);
    c.status(204);
    c.body(null);
  }
};
