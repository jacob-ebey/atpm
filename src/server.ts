import { scope } from "@atcute/oauth-node-client";
import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";
import { atcute } from "hono-atcute";
import { createStores } from "hono-atcute/cloudflare";

import appController from "@/controllers/app";
import registry from "@/controllers/registry";
import oauth from "@/controllers/oauth";
import { database } from "@/db/middleware";
import { htmxRedirects } from "@/lib/htmx";
import { srvJsxRenderer } from "@/lib/renderer";

export { AtprotoStore } from "hono-atcute/cloudflare";
export { CliAuthSession } from "@/models/cli-auth-session";

declare global {
  interface Env {
    Bindings: Cloudflare.Env;
  }
}

const app = new Hono<Env>();

app.use(
  async (c, next) => {
    c.header("Cache-Control", "no-cache");
    c.header("Vary", "cookie");
    await next();
  },
  contextStorage(),
  atcute({
    localdev: import.meta.env.DEV,
    callbackPath: "/oauth/callback",
    metadata: (c) => ({
      client_name: "ATPM",
      logo_uri: new URL("/favicon.svg", c.req.url).href,
    }),
    scope: () => [
      scope.rpc({ lxm: ["app.bsky.actor.getProfile"], aud: "*" }),
      scope.repo({
        collection: ["dev.atpm.alpha.package", "dev.atpm.alpha.stage"],
        action: ["create", "update", "delete"],
      }),
      scope.blob({ accept: ["application/octet-stream"] }),
    ],
    stores: (c) => createStores(c.env.ATPROTO_STORE),
  }),
  database(),
  srvJsxRenderer(),
  htmxRedirects(),
);

app.route("/registry", registry);
app.route("/oauth", oauth);
app.route("/", appController);

export default app;
