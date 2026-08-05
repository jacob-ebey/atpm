import { DurableObject } from "cloudflare:workers";

import { Client } from "@atcute/client";
import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from "@atcute/identity-resolver";
import { NodeDnsHandleResolver } from "@atcute/identity-resolver-node";
import { isDid } from "@atcute/lexicons/syntax";
import {
  OAuthClient,
  OAuthSession,
  scope as scopes,
  type ClientAssertionPrivateJwk,
  type OAuthClientStores,
} from "@atcute/oauth-node-client";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";

declare module "hono" {
  interface ContextVariableMap {
    atproto?: Client & { session: OAuthSession };
    oauth: OAuthClient;
  }
}

export async function setSessionDid(c: Context<Env, any, any>, did: string) {
  await setSignedCookie(c, "did", did, c.env.SESSION_SECRET, {
    path: "/",
    domain: new URL(c.req.url).hostname,
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
  });
}

export function clearSessionDid(c: Context) {
  deleteCookie(c, "did");
}

export function createOAuthClient(env: Cloudflare.Env, url: string) {
  const scope = [scopes.rpc({ lxm: ["app.bsky.actor.getProfile"], aud: "*" })];

  const actorResolver = new LocalActorResolver({
    handleResolver: new CompositeHandleResolver({
      methods: {
        dns: new NodeDnsHandleResolver(),
        http: new WellKnownHandleResolver(),
      },
    }),
    didDocumentResolver: new CompositeDidDocumentResolver({
      methods: {
        plc: new PlcDidDocumentResolver(),
        web: new WebDidDocumentResolver(),
      },
    }),
  });

  const stores: OAuthClientStores = {
    sessions: {
      get(did) {
        return env.ATPROTO_STORE.getByName(`session:${did}`).get();
      },
      async set(did, session) {
        await env.ATPROTO_STORE.getByName(`session:${did}`).set(session);
        // ...
      },
      async delete(did) {
        await env.ATPROTO_STORE.getByName(`session:${did}`).delete();
        // ...
      },
      async clear() {},
    },
    states: {
      async get(stateId) {
        return env.ATPROTO_STORE.getByName(`state:${stateId}`).get();
      },
      async set(stateId, state) {
        await env.ATPROTO_STORE.getByName(`state:${stateId}`).set(state);
      },
      async delete(stateId) {
        await env.ATPROTO_STORE.getByName(`state:${stateId}`).delete();
      },
      async clear() {},
    },
  };

  return new OAuthClient(
    import.meta.env.DEV
      ? {
          actorResolver,
          stores,
          metadata: {
            redirect_uris: [new URL("/oauth/callback", url).href],
            scope,
          },
        }
      : {
          actorResolver,
          stores,
          keyset: [JSON.parse(env.PRIVATE_KEY_JWK) as ClientAssertionPrivateJwk],
          metadata: {
            client_id: new URL("/oauth-client-metadata.json", url).href,
            jwks_uri: new URL("/jwks.json", "127.0.0.1").href,
            redirect_uris: [new URL("/oauth/callback", url).href],
            scope,
          },
        },
  );
}

export const atproto = (): MiddlewareHandler<Env> => async (c, next) => {
  const oauth = createOAuthClient(c.env, c.req.url);
  c.set("oauth", oauth);

  const did = await getSignedCookie(c, c.env.SESSION_SECRET, "did");
  if (isDid(did)) {
    const session = await oauth.restore(did).catch(() => undefined);
    if (session) {
      c.set("atproto", Object.assign(new Client({ handler: session }), { session }));
    }
  }

  return next();
};

export class AtprotoStore extends DurableObject {
  value: unknown;
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.value = await ctx.storage.get("value");
    });
  }
  async get(): Promise<unknown> {
    return this.value;
  }
  async set(value: unknown) {
    this.value = value;
    await this.ctx.storage.put("value", value, { allowConcurrency: false });
  }
  async delete() {
    this.value = undefined;
    await this.ctx.storage.deleteAll();
  }
}
