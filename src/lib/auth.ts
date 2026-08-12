import type { ActorResolver } from "@atcute/identity-resolver";
import type { Did } from "@atcute/lexicons";
import type { OAuthClient, OAuthSession } from "@atcute/oauth-node-client";
import type { MiddlewareHandler } from "hono";
import * as jose from "jose";

import { Client } from "@atcute/client";
import { isDid } from "@atcute/lexicons/syntax";

export const requireAuth =
  (): MiddlewareHandler<{
    Bindings: Cloudflare.Env;
    Variables: {
      atcute: {
        authenticated: true;
        actorResolver: ActorResolver;
        client: Client;
        oauth: OAuthClient;
        publicClient: Client;
        session: OAuthSession;
        restrictedToPackage?: string;
      };
    };
  }> =>
  async (c, next) => {
    const atcute = c.get("atcute");
    if (!atcute.authenticated) {
      const url = new URL(c.req.url);
      return c.redirect(new URL(`/?login&returnTo=${encodeURI(url.pathname)}`, c.req.url));
    }
    await next();
  };

export const requireCliAuth =
  (
    claims?: Record<string, unknown>,
  ): MiddlewareHandler<{
    Bindings: Cloudflare.Env;
    Variables: {
      atcute: {
        authenticated: true;
        actorResolver: ActorResolver;
        client: Client;
        oauth: OAuthClient;
        publicClient: Client;
        session: OAuthSession;
        restrictedToPackage?: string;
      };
    };
  }> =>
  async (c, next) => {
    const atcute = c.get("atcute");

    const url = new URL(c.req.url);
    const authorization = c.req.header("Authorization")?.replace(/^Bearer\s+/, "");
    if (!authorization) return c.json({ error: 'missing "Bearer" header.' }, 401);

    let did: string | undefined;
    let restrictedToPackage: string | undefined;
    if (authorization.startsWith("cli")) {
      console.log("CLI");
      const token = authorization.slice(3);
      const verified = await jose
        .jwtVerify(token, new TextEncoder().encode(c.env.SESSION_SECRET), {
          ...claims,
          issuer: url.origin,
        })
        .catch(() => false as const);
      if (!verified) return c.json({ error: "invalid authorization" }, 401);
      const sessionId = verified.payload.sub;
      const secret = verified.payload.aud;

      if (!sessionId || !secret) return c.json({ error: "invalid authorization" }, 401);

      const res = await c.env.CLI_AUTH_SESSION.getByName(sessionId).poll();
      if (res.state !== "done" || res.secret !== secret || !res.did)
        return c.json({ error: "invalid session" }, 401);
      did = res.did;
    } else if (authorization.startsWith("ci")) {
      const token = authorization.slice(2);
      console.log("CI");
      const verified = await jose
        .jwtVerify(token, new TextEncoder().encode(c.env.SESSION_SECRET), {
          ...claims,
          issuer: url.origin,
        })
        .catch((e) => {
          console.error("jwtVerify error", e);
          return false as const;
        });
      if (!verified) return c.json({ error: "invalid authorization" }, 401);
      const sub = verified.payload.sub;
      if (!isDid(sub) || (verified.payload.aud && typeof verified.payload.aud !== "string")) {
        console.log({
          verified,
        });
        return c.json({ error: "invalid authorization" }, 401);
      }
      did = sub;
      restrictedToPackage = verified.payload.aud as string;
    } else {
      console.log("INVALID TOKEN", { [authorization[0]]: 0, [authorization[1]]: 1 });
      return c.json({ error: "invalid authorization" }, 401);
    }

    if (!did) {
      console.log("NO DID");
      return c.json({ error: "invalid authorization" }, 401);
    }

    const atcuteSession = await atcute.oauth.restore(did as Did).catch(() => undefined);
    if (!atcuteSession) {
      console.log("NO ATCOUTE SESSION");
      return c.json({ error: "invalid atproto session" }, 401);
    }
    const client = new Client({ handler: atcuteSession });

    c.set("atcute", {
      authenticated: true,
      actorResolver: atcute.actorResolver,
      client,
      oauth: atcute.oauth,
      publicClient: atcute.publicClient,
      session: atcuteSession,
      restrictedToPackage,
    });

    await next();
  };
