import { type ActorIdentifier } from "@atcute/lexicons";
import type * as npm from "@npm/types";
import { Hono } from "hono";
import validatePackageName from "validate-npm-package-name";

import { Client, simpleFetchHandler } from "@atcute/client";
import { sign } from "@/lib/sign";

const app = new Hono<Env>();

app.get("/:package", async (c) => {
  const atcute = c.get("atcute");
  const packageParam = c.req.param("package");

  if (!packageParam.startsWith("@") || !validatePackageName(packageParam).validForNewPackages) {
    return c.json({ error: "invalid package name" }, { status: 400 });
  }

  let [handle, packageName] = packageParam.split("/");
  handle = handle.slice(1);

  const resolved = await atcute.actorResolver
    .resolve(handle as ActorIdentifier)
    .catch(() => undefined);

  if (!resolved) {
    return c.json({ error: "package not found" }, { status: 404 });
  }

  const client = new Client({ handler: simpleFetchHandler({ service: resolved.pds }) });

  const recordResponse = await client.get("com.atproto.repo.getRecord", {
    params: {
      repo: resolved.did,
      collection: "dev.atpm.package",
      rkey: packageName,
    },
  });

  if (!recordResponse.ok) {
    return c.json({ error: "package not found" }, { status: 404 });
  }

  return c.json({
    _rev: recordResponse.data.cid || recordResponse.data.uri,
    _id: `${resolved.did}/${packageName}`,
    name: `@${handle}/${packageName}`,
    "dist-tags": {},
    time: {
      modified: "",
      created: "",
    },
    versions: {},
  } satisfies npm.Packument);
});

app.put("/:package", (c) => {
  console.log("PUT");
  return c.json({ error: "not found" }, { status: 404 });
});

app.get("/:packageName/-/:tarballName", (c) => {
  return c.json({ error: "not found" }, { status: 404 });
});

app.get("/:packageScope/:packageName/-/:tarballScope/:tarballName", (c) => {
  return c.json({ error: "not found" }, { status: 404 });
});

app.post("/-/v1/login", async (c) => {
  const sessionId = crypto.randomUUID();
  const session = c.env.CLI_AUTH_SESSION.getByName(sessionId);
  await session.setup();

  const loginUrl = new URL("/login", c.req.url);
  loginUrl.searchParams.set("returnTo", `/registry/-/cli/${sessionId}`);

  const doneUrl = new URL("/registry/-/v1/done", c.req.url);
  doneUrl.searchParams.set("sessionId", sessionId);

  return c.json({
    loginUrl,
    doneUrl,
  });
});

app.get("/-/v1/done", async (c) => {
  const url = new URL(c.req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) return c.json({ error: "no session" }, 404);
  const session = c.env.CLI_AUTH_SESSION.getByName(sessionId);

  const result = await session.poll();
  if (result.state === "pending") return c.json("", 202);
  if (result.state === "timed-out") return c.json({ error: "timed out" }, 404);

  const atcute = c.get("atcute");
  const oauthSession = await atcute.oauth.restore(result.did as any).catch(() => undefined);
  if (!oauthSession) return c.json({ error: "no session" }, 404);
  if (!result.secret) return c.json({ error: "no secret" }, 404);

  const token = await sign(sessionId + "." + result.secret, c.env.SESSION_SECRET);
  return c.json({ token }, 200);
});

app.get("/-/cli/:sessionId", async (c) => {
  const atcute = c.get("atcute");
  if (!atcute.session)
    return c.redirect(
      new URL(`/login?error=${encodeURI("Failed to login: no session")}`, c.req.url),
    );
  const session = c.env.CLI_AUTH_SESSION.getByName(c.req.param("sessionId"));
  const result = await session.finish(atcute.session.did);
  if (result.state !== "done") {
    return c.redirect(
      new URL(`/login?error=${encodeURI("Failed to login: invalid state")}`, c.req.url),
    );
  }
  return c.redirect(new URL("/login?success", c.req.url));
});

// app.all("*", async (c) => {
//   console.log(c.req.url);
//   const url = new URL(c.req.url);
//   const forwardedUrl = new URL(url.pathname + url.search, "https://registry.npmjs.org");
//   const response = await fetch(forwardedUrl, {
//     method: c.req.method,
//     headers: c.req.raw.headers,
//     body: c.req.raw.body,
//   });
//   const response2 = response.clone();
//   console.log(await response2.json());
//   return response;
// });

export default app;
