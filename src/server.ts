import { scope } from "@atcute/oauth-node-client";
import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";
import { csrf } from "hono/csrf";
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
  contextStorage(),
  csrf(),
  atcute({
    localdev: import.meta.env.DEV,
    callbackPath: "/oauth/callback",
    metadata: (c) => ({
      client_name: "AT Starter",
      logo_uri: new URL("/favicon.svg", c.req.url).href,
    }),
    scope: () => [
      scope.rpc({ lxm: ["app.bsky.actor.getProfile"], aud: "*" }),
      scope.repo({ collection: ["xyz.statusphere.status"], action: ["create"] }),
    ],
    stores: (c) => createStores(c.env.ATPROTO_STORE),
  }),
  database(),
  srvJsxRenderer(),
  htmxRedirects(),
);

app.route("/", appController);
app.route("/registry", registry);
app.route("/oauth", oauth);

export default app;
