import type { MiddlewareHandler } from "hono";

export const requireAuth = (): MiddlewareHandler => async (c, next) => {
  const atcute = c.get("atcute");
  if (!atcute.session) {
    const url = new URL(c.req.url);
    return c.redirect(new URL(`/?returnTo=${encodeURI(url.pathname + url.search)}`, c.req.url));
  }
  await next();
};
