import type { ResolvedActor } from "@atcute/identity-resolver";
import type { Did } from "@atcute/lexicons";
import type { OAuthSession } from "@atcute/oauth-node-client";
import type { MiddlewareHandler } from "hono";

import { validate } from "@/lib/sign";

export const requireAuth = (): MiddlewareHandler => async (c, next) => {
  const atcute = c.get("atcute");
  if (!atcute.session) {
    const url = new URL(c.req.url);
    return c.redirect(new URL(`/?login&returnTo=${encodeURI(url.pathname)}`, c.req.url));
  }
  await next();
};

export const requireCliAuth =
  (): MiddlewareHandler<{
    Bindings: Cloudflare.Env;
    Variables: {
      actor: ResolvedActor;
      cliSession: OAuthSession;
    };
  }> =>
  async (c, next) => {
    const authorization = c.req.header("Authorization")?.replace(/^Bearer /, "");
    if (!authorization) return c.json({ error: 'missing "Bearer" header.' }, 401);
    const validated = await validate(authorization, c.env.SESSION_SECRET);
    if (!validated.ok) return c.json({ error: "invalid authorization" }, 401);
    const [sessionId, secret] = validated.value.split(".");
    if (!sessionId || !secret) return c.json({ error: "invalid authorization" }, 401);
    const session = c.env.CLI_AUTH_SESSION.getByName(sessionId);
    const result = await session.poll();
    if (result.state !== "done" || !result.secret || !result.did)
      return c.json({ error: "invalid session" }, 401);

    const atcute = c.get("atcute");
    const cliSession = await atcute.oauth.restore(result.did as Did).catch(() => undefined);
    if (!cliSession) return c.json({ error: "invalid atproto session" }, 401);
    const actor = await atcute.actorResolver.resolve(cliSession.did).catch(() => undefined);
    if (!actor?.pds) return c.json({ error: "actor not found" }, 401);
    c.set("actor", actor);
    c.set("cliSession", cliSession);

    await next();
  };
