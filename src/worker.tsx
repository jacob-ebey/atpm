import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";
import { csrf } from "hono/csrf";

import { App } from "@/app";
import oauth from "@/controllers/oauth";
import { atproto } from "@/lib/atproto";
import { htmxRedirects } from "@/lib/htmx";
import { srvJsxRenderer } from "@/lib/renderer";

export { AtprotoStore } from "@/lib/atproto";
export { Profile } from "@/models/profile";

declare global {
  interface Env {
    Bindings: Cloudflare.Env;
  }
}

const app = new Hono<Env>();

app.use(contextStorage(), csrf(), atproto(), srvJsxRenderer(), htmxRedirects());

app.get("/", ({ render }) => {
  return render(<App />);
});

app.route("/oauth", oauth);

export default app;
