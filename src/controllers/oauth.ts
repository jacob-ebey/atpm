import { ComAtprotoIdentityResolveIdentity } from "@atcute/atproto";
import { AppBskyActorGetProfile } from "@atcute/bluesky";
import { Client } from "@atcute/client";
import { isActorIdentifier, type ActorIdentifier } from "@atcute/lexicons/syntax";
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
  const oauth = c.get("oauth");
  const formData = Object.fromEntries(await c.req.formData());
  const parsed = v.safeParse(LoginSchema, formData);

  if (!parsed.success) {
    return c.redirect(new URL(`/?error=${encodeURI("Login Failed: Invalid handle")}`, c.req.url));
  }

  try {
    const result = await oauth.authorize({
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
  clearSessionDid(c);
  return c.redirect(new URL("/", c.req.url));
});

app.get("/authorize", async (c) => {
  const identifier = new URL(c.req.url).searchParams.get("identifier");

  if (!isActorIdentifier(identifier)) return c.redirect(new URL("/", c.req.url));

  const oauth = c.get("oauth");
  const authorization = await oauth.authorize({ target: { type: "account", identifier } });
  return c.redirect(authorization.url);
});

app.get("/callback", async (c) => {
  const oauth = c.get("oauth");
  try {
    const result = await oauth.callback(new URL(c.req.url).searchParams);
    const atproto = new Client({ handler: result.session });

    const profileStub = c.env.PROFILE.getByName(result.session.did);
    const profile = await profileStub.get();
    if (!profile) {
      let displayName: string | undefined;
      let handle: string | undefined;
      const profile = await atproto.call(AppBskyActorGetProfile, {
        params: { actor: result.session.did },
      });
      if (profile.ok) {
        displayName = profile.data.displayName || profile.data.handle;
        handle = profile.data.handle;
      }

      if (!displayName || !handle) {
        const identity = await atproto.call(ComAtprotoIdentityResolveIdentity, {
          params: { identifier: result.session.did },
        });
        if (identity.ok) {
          displayName = identity.data.handle;
          handle = identity.data.handle;
        }
      }

      if (!displayName) displayName = "Unknown";
      if (!handle) return c.redirect(new URL(`/?error=${encodeURI("Failed to resolve handle")}`));

      await profileStub.set({ handle, displayName });
    }

    await setSessionDid(c, result.session.did);
    return c.redirect(new URL("/", c.req.url));
  } catch {
    return c.redirect(new URL(`/?error=${encodeURI("Failed to login")}`, c.req.url));
  }
});

export default app;
