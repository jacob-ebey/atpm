import { DurableObject } from "cloudflare:workers";

import { Client, simpleFetchHandler } from "@atcute/client";
import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
  type ActorResolver,
} from "@atcute/identity-resolver";
import { NodeDnsHandleResolver } from "@atcute/identity-resolver-node";
import { isDid } from "@atcute/lexicons/syntax";
import {
  OAuthClient,
  OAuthSession,
  type ClientAssertionPrivateJwk,
  type OAuthClientOptions,
  type OAuthClientStores,
} from "@atcute/oauth-node-client";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";

type Atcute =
  | {
      authenticated: true;
      actorResolver: ActorResolver;
      client: Client;
      oauth: OAuthClient;
      publicClient: Client;
      session: OAuthSession;
    }
  | {
      authenticated: false;
      actorResolver: ActorResolver;
      client?: Client;
      oauth: OAuthClient;
      publicClient: Client;
      session?: OAuthSession;
    };

declare module "hono" {
  interface ContextVariableMap {
    atcute: Atcute;
  }
}

export async function setSessionDid(
  c: Context<any, any, any>,
  did: string,
  sessionSecret?: (c: Context) => string,
) {
  await setSignedCookie(c, "did", did, sessionSecret ? sessionSecret(c) : c.env.SESSION_SECRET, {
    path: "/",
    domain: new URL(c.req.url).hostname,
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
  });
}

export function clearSessionDid(c: Context) {
  deleteCookie(c, "did", {
    domain: new URL(c.req.url).hostname,
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
  });
}

type Metadata = Partial<
  Omit<OAuthClientOptions["metadata"], "redirect_uris" | "scope" | "client_id" | "jwks_uri">
>;

function createOAuthClient(args: {
  c: Context;
  fetch?: typeof fetch;
  actorResolver: ActorResolver;
  callbackPath: string;
  localdev?: boolean;
  metadata?: Metadata | ((c: Context) => Metadata);
  scope: (c: Context) => string | string[];
  stores: OAuthClientStores | ((c: Context) => OAuthClientStores);
  privateKeyJwk?:
    | ClientAssertionPrivateJwk
    | string
    | ((c: Context) => ClientAssertionPrivateJwk | string);
}) {
  const scope = args.scope(args.c);

  const stores: OAuthClientStores =
    typeof args.stores === "function" ? args.stores(args.c) : args.stores;

  let keyset: ClientAssertionPrivateJwk[] | undefined;
  if (!args.localdev) {
    const key =
      typeof args.privateKeyJwk === "function"
        ? args.privateKeyJwk(args.c)
        : (args.privateKeyJwk ?? (args.c.env.PRIVATE_KEY_JWK as string));
    if (!key) throw new Error("PRIVATE_KEY_JWK not set");
    keyset = typeof key === "string" ? [JSON.parse(key) as ClientAssertionPrivateJwk] : [key];
  }

  return new OAuthClient(
    args.localdev
      ? {
          fetch: args.fetch,
          actorResolver: args.actorResolver,
          stores,
          metadata: {
            redirect_uris: [new URL(args.callbackPath, args.c.req.url).href],
            scope,
            ...(typeof args.metadata === "function" ? args.metadata(args.c) : args.metadata),
          },
        }
      : {
          fetch: args.fetch,
          actorResolver: args.actorResolver,
          stores,
          keyset,
          metadata: {
            client_id: new URL("/oauth-client-metadata.json", args.c.req.url).href,
            jwks_uri: new URL("/jwks.json", args.c.req.url).href,
            redirect_uris: [new URL(args.callbackPath, args.c.req.url).href],
            scope,
            ...(typeof args.metadata === "function" ? args.metadata(args.c) : args.metadata),
          },
        },
  );
}

type Args = {
  fetch?: typeof fetch;
  actorResolver?: ActorResolver;
  callbackPath: string;
  metadata?: Metadata | ((c: Context) => Metadata);
  scope: (c: Context) => string | string[];
  stores: OAuthClientStores | ((c: Context) => OAuthClientStores);
  /**
   * @default c.env.SESSION_SECRET
   */
  sessionSecret?: (c: Context) => string;
  /**
   * @default c.env.PRIVATE_KEY_JWK
   */
  privateKeyJwk?:
    | ClientAssertionPrivateJwk
    | string
    | ((c: Context) => ClientAssertionPrivateJwk | string);
  localdev?: boolean;
};

export const atcute =
  ({
    fetch,
    actorResolver,
    callbackPath,
    metadata,
    scope,
    stores,
    localdev,
    privateKeyJwk,
    sessionSecret,
  }: Args): MiddlewareHandler =>
  async (c, next) => {
    actorResolver ??= new LocalActorResolver({
      handleResolver: new CompositeHandleResolver({
        methods: {
          dns: new NodeDnsHandleResolver(),
          http: new WellKnownHandleResolver({ fetch }),
        },
      }),
      didDocumentResolver: new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver({ fetch }),
          web: new WebDidDocumentResolver({ fetch }),
        },
      }),
    });

    const oauth = createOAuthClient({
      c,
      fetch,
      actorResolver,
      callbackPath,
      privateKeyJwk,
      metadata,
      scope,
      stores,
      localdev,
    });

    const url = new URL(c.req.url);
    if (url.pathname === "/oauth-client-metadata.json") {
      return c.json(oauth.metadata);
    }
    if (url.pathname === "/jwks.json") {
      return c.json(oauth.jwks);
    }

    const did = await getSignedCookie(
      c,
      sessionSecret ? sessionSecret(c) : c.env.SESSION_SECRET,
      "did",
    );
    let session: OAuthSession | undefined;
    if (isDid(did)) {
      session = await oauth.restore(did).catch(() => undefined);
    }

    const publicClient = new Client({
      handler: simpleFetchHandler({ service: "https://public.api.bsky.app", fetch }),
    });

    const atcute: Atcute = session
      ? {
          authenticated: true,
          actorResolver,
          client: new Client({ handler: session }),
          oauth,
          publicClient,
          session,
        }
      : {
          authenticated: false,
          actorResolver,
          oauth,
          publicClient,
        };

    c.set("atcute", atcute);

    return next();
  };

export function createStores(namespace: DurableObjectNamespace<AtprotoStore>): OAuthClientStores {
  return {
    sessions: {
      get(did) {
        return namespace.getByName(`session:${did}`).get();
      },
      async set(did, session) {
        await namespace.getByName(`session:${did}`).set(session);
      },
      async delete(did) {
        await namespace.getByName(`session:${did}`).delete();
      },
      async clear() {},
    },
    states: {
      async get(stateId) {
        return namespace.getByName(`state:${stateId}`).get();
      },
      async set(stateId, state) {
        await namespace.getByName(`state:${stateId}`).set(state);
      },
      async delete(stateId) {
        await namespace.getByName(`state:${stateId}`).delete();
      },
      async clear() {},
    },
  };
}

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
