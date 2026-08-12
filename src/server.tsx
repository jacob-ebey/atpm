import "reflect-metadata";
import { scope } from "@atcute/oauth-node-client";
import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";

import appController from "@/controllers/app";
import registry from "@/controllers/registry";
import oauth from "@/controllers/oauth";
import { database } from "@/db/middleware";
import { atcute, createStores } from "@/lib/atcute";
import { htmxRedirects } from "@/lib/htmx";
import { srvJsxRenderer } from "@/lib/renderer";
import { Body, Head } from "./components/document";
import { Layout } from "./containers/layout";

export { AtprotoStore } from "@/lib/atcute";
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
    await next();
    if (!c.res.headers.get("Cache-Control")) {
      c.header("Cache-Control", "no-cache");
    }
    c.header("Vary", "accept", { append: true });
    c.header("Vary", "cookie", { append: true });
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
        collection: [
          "dev.atpm.alpha.package",
          "dev.atpm.alpha.stage",
          "dev.atpm.alpha.trustPublisher",
        ],
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

app.route("/oauth", oauth);
app.route("/", appController);
app.route("/", registry);
app.notFound((c) => {
  c.status(404);
  return c.render(
    <html>
      <Head>
        <title>404 Not Found</title>
      </Head>
      <Body>
        <Layout>
          <main>
            <section class="empty">
              <header>
                <h3>404 Not Found</h3>
                <p>We couldn't find the page you're looking for.</p>
              </header>
              <footer>
                <div class="flex gap-2">
                  <a href="/" class="btn">
                    Go Home
                  </a>
                </div>
              </footer>
            </section>
          </main>
        </Layout>
      </Body>
    </html>,
  );
});

export default app;
