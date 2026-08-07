import { type ActorIdentifier } from "@atcute/lexicons/syntax";
import { Hono } from "hono";
import { clearSessionDid, setSessionDid } from "hono-atcute";
import * as v from "valibot";

const app = new Hono<Env>();

const ReturnToSchema = v.fallback(
  v.custom<string>((v) => {
    if (typeof v === "string" && v.startsWith("/") && v.at(1) !== "/") {
      const url = new URL(v, "https://validation.com/");
      return url.pathname + url.search === v;
    }
    return false;
  }),
  "/",
);

const LoginSchema = v.object({
  returnTo: ReturnToSchema,
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
    const returnTo = v.parse(ReturnToSchema, formData.returnTo);
    const redirect = new URL(returnTo, c.req.url);
    redirect.searchParams.set("returnTo", returnTo);
    redirect.searchParams.set("error", "Login Failed: Invalid handle");
    return c.redirect(redirect.href);
  }

  try {
    const result = await atcute.oauth.authorize({
      target: {
        type: "account",
        identifier: parsed.output.handle as ActorIdentifier,
      },
      state: parsed.output.returnTo,
    });
    return c.redirect(result.url);
  } catch {
    const redirect = new URL(parsed.output.returnTo, c.req.url);
    redirect.searchParams.set("returnTo", parsed.output.returnTo);
    redirect.searchParams.set("error", "Login Failed: Could not resolve handle");
    return c.redirect(redirect.href);
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
    const returnTo = v.parse(ReturnToSchema, result.state);
    await setSessionDid(c, result.session.did);
    return c.redirect(new URL(returnTo, c.req.url));
  } catch {
    const redirect = new URL("/", c.req.url);
    redirect.searchParams.set("error", "Failed to login");
    return c.redirect(redirect.href);
  }
});

export default app;
