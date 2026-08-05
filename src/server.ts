import { scope } from "@atcute/oauth-node-client";
import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";
import { csrf } from "hono/csrf";
import { atproto } from "hono-atcute";
import { createAtprotoStores } from "hono-atcute/cloudflare";

import marketing from "@/controllers/marketing";
import oauth from "@/controllers/oauth";
import { htmxRedirects } from "@/lib/htmx";
import { srvJsxRenderer } from "@/lib/renderer";

export { AtprotoStore } from "hono-atcute/cloudflare";
export { Profile } from "@/models/profile";

declare global {
  interface Env {
    Bindings: Cloudflare.Env;
  }
}

const app = new Hono<Env>();

app.use(
  contextStorage(),
  csrf(),
  atproto({
    localdev: import.meta.env.DEV,
    scope: () => [scope.rpc({ lxm: ["app.bsky.actor.getProfile"], aud: "*" })],
    stores: (c) => createAtprotoStores(c.env.ATPROTO_STORE),
  }),
  srvJsxRenderer(),
  htmxRedirects(),
);

app.route("", marketing);
app.route("/oauth", oauth);

export default app;
