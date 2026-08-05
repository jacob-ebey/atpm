import type { MiddlewareHandler } from "hono";

export const htmxRedirects = (): MiddlewareHandler => async (c, next) => {
  await next();

  if (c.res.status >= 300 && c.res.status < 400 && c.req.header("hx-request") === "true") {
    const location = c.res.headers.get("location");
    if (!location) return;
    c.res.headers.delete("location");
    const url = new URL(c.req.url);
    const locationUrl = new URL(location, c.req.url);
    if (locationUrl.origin === url.origin) {
      c.header("hx-location", location);
    } else {
      c.header("hx-redirect", location);
    }
    c.status(204);
    c.body(null);
  }
};
