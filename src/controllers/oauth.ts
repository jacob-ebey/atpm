import { type ActorIdentifier } from "@atcute/lexicons/syntax";
import { Hono } from "hono";
import { clearSessionDid, setSessionDid } from "hono-atcute";
import * as v from "valibot";

const app = new Hono<Env>();

const LoginSchema = v.object({
  handle: v.union([
    v.pipe(v.string(), v.domain()),
    v.pipe(v.string(), v.regex(/^did:[a-z]+:[a-zA-Z0-9]+$/)),
  ]),
});

app.post("/login", async (c) => {
  const atcute = c.get("atcute");
  const formData = Object.fromEntries(await c.req.formData());
  const parsed = v.safeParse(LoginSchema, formData);

  if (!parsed.success) {
    return c.redirect(new URL(`/?error=${encodeURI("Login Failed: Invalid handle")}`, c.req.url));
  }

  try {
    const result = await atcute.oauth.authorize({
      target: {
        type: "account",
        identifier: parsed.output.handle as ActorIdentifier,
      },
    });
    return c.redirect(result.url);
  } catch {
    return c.redirect(
      new URL(`/?error=${encodeURI("Login Failed: Could not resolve handle")}`, c.req.url),
    );
  }
});

app.post("/logout", async (c) => {
  const atcute = c.get("atcute");
  clearSessionDid(c);
  await atcute.session?.signOut().catch(() => {});
  return c.redirect(new URL("/", c.req.url));
});

app.get("/callback", async (c) => {
  const atcute = c.get("atcute");
  try {
    const result = await atcute.oauth.callback(new URL(c.req.url).searchParams);
    await setSessionDid(c, result.session.did);
    return c.redirect(new URL("/", c.req.url));
  } catch {
    return c.redirect(new URL(`/?error=${encodeURI("Failed to login")}`, c.req.url));
  }
});

export default app;
