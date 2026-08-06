import type { MiddlewareHandler } from "hono";

export const htmxRedirects = (): MiddlewareHandler => async (c, next) => {
  await next();

  if (c.res.status >= 300 && c.res.status < 400 && c.req.header("HX-Request") === "true") {
    const location = c.res.headers.get("Location");
    if (!location) return;
    c.res.headers.delete("Location");
    c.status(204);
    c.header("HX-Redirect", location);
    const res = c.body(null);
    c.res = res;
    return res;
  }
};
