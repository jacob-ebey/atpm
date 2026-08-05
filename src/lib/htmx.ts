import type { MiddlewareHandler } from "hono";

export const htmxRedirects = (): MiddlewareHandler => async (c, next) => {
  await next();

  if (c.res.status >= 300 && c.res.status < 400 && c.req.header("HX-Request") === "true") {
    const location = c.res.headers.get("Location");
    if (!location) return;
    c.res.headers.delete("Location");
    c.header("HX-Redirect", location);
    c.status(204);
    return c.body(null);
  }
};
