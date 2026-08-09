import { Client, simpleFetchHandler } from "@atcute/client";
import { type ActorIdentifier, type Did } from "@atcute/lexicons";
import type * as npm from "@npm/types";
import { Context, Hono } from "hono";
import validatePackageName from "validate-npm-package-name";

import { sign, validate } from "@/lib/sign";
import {
  ComAtprotoRepoGetRecord,
  ComAtprotoRepoPutRecord,
  ComAtprotoRepoUploadBlob,
} from "@atcute/atproto";
import { DevAtpmAlphaPackage as DevAtpmPackage } from "@/lexicons";
import { base64ToBlob } from "@/lib/base64";
import { getCursor, indexEvent } from "@/models/packages";

const app = new Hono<Env>();

app.get("/:package", async (c) => {
  const atcute = c.get("atcute");
  const packageParam = c.req.param("package");

  if (!packageParam.startsWith("@")) {
    return proxyRequest(c);
  }

  if (!validatePackageName(packageParam).validForNewPackages) {
    return c.json({ error: "invalid package name" }, { status: 400 });
  }

  let [handle, packageName] = packageParam.split("/");
  handle = handle.slice(1);

  const resolved = await atcute.actorResolver
    .resolve(handle as ActorIdentifier)
    .catch(() => undefined);

  if (!resolved) {
    return proxyRequest(c);
  }

  const client = new Client({ handler: simpleFetchHandler({ service: resolved.pds }) });

  const recordResponse = await client.get("com.atproto.repo.getRecord", {
    params: {
      repo: resolved.did,
      collection: "dev.atpm.alpha.package",
      rkey: packageName,
    },
  });

  if (!recordResponse.ok) {
    return proxyRequest(c);
  }

  const data = recordResponse.data.value as DevAtpmPackage.Main;

  if (data.type !== "npm") return proxyRequest(c);

  const versions: Record<string, npm.PackumentVersion> = {};
  let modified: number = new Date(data.createdAt).getTime();

  for (const pkg of data.versions) {
    versions[pkg.version] = pkg.meta as npm.PackumentVersion;
    if (new Date(pkg.createdAt).getTime() > modified) {
      modified = new Date(pkg.createdAt).getTime();
    }
  }

  c.header("Cache-Control", "public, max-age=500");
  return c.json({
    _rev: recordResponse.data.cid || recordResponse.data.uri,
    _id: `${resolved.did}/${packageName}`,
    name: `@${handle}/${packageName}`,
    "dist-tags": data.tags as Record<string, string>,
    time: {
      created: data.createdAt,
      modified: new Date(modified).toISOString(),
    },
    versions,
  } satisfies npm.Packument);
});

app.put("/:package", async (c) => {
  const packageParam = c.req.param("package");
  const [scope, name] = packageParam.split("/");
  if (!scope?.startsWith("@")) return c.json({ error: "package name must include @ scope" }, 400);

  const authorization = c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (!authorization) return c.json({ error: 'missing "Bearer" header.' }, 401);
  const validated = await validate(authorization, c.env.SESSION_SECRET);
  if (!validated.ok) return c.json({ error: "invalid authorization" }, 401);
  const [sessionId, secret] = validated.value.split(".");
  if (!sessionId || !secret) return c.json({ error: "invalid authorization" }, 401);
  const session = c.env.CLI_AUTH_SESSION.getByName(sessionId);
  const result = await session.poll();
  if (result.state !== "done" || !result.secret) return c.json({ error: "invalid session" }, 401);
  if (result.secret !== secret || !result.did) return c.json({ error: "secret miss-match" }, 401);
  const atcute = c.get("atcute");
  const atcuteSession = await atcute.oauth.restore(result.did as Did).catch(() => undefined);
  if (!atcuteSession) return c.json({ error: "invalid atproto session" }, 401);
  const actor = await atcute.actorResolver.resolve(atcuteSession.did).catch(() => undefined);
  if (!actor?.pds) return c.json({ error: "actor not found" }, 404);

  if (scope.slice(1) !== actor.handle)
    return c.json({ error: "scope does not match actor handle" }, 403);

  const client = new Client({ handler: atcuteSession });

  const body = (await c.req.json()) as {
    _id: string;
    access: null | string;
    name: string;
    "dist-tags": Record<string, string>;
    versions: Record<
      string,
      {
        _id: string;
        _nodeVersion: string;
        _npmVersion: string;
        name: string;
        version: string;
        dependencies: Record<string, string>;
        readme: string;
        dist: {
          integrity: string;
          shasum: string;
          tarball: string;
        };
      }
    >;
    _attachments: Record<
      string,
      {
        content_type: string;
        data: string;
        length: number;
      }
    >;
  };

  const existingPackage = await client.call(ComAtprotoRepoGetRecord, {
    params: {
      repo: atcuteSession.did,
      collection: "dev.atpm.alpha.package",
      rkey: name,
    },
  });

  const versions: DevAtpmPackage.Package[] = existingPackage?.ok
    ? [...(existingPackage.data.value.versions as DevAtpmPackage.Package[])]
    : [];

  for (const [version, meta] of Object.entries(body.versions)) {
    if (versions.some((v) => v.version === version))
      return c.json({ error: "version already exists" }, 403);

    const tarballName = `${scope}/${name}-${version}.tgz`;
    const attachment = body._attachments[tarballName];
    if (!attachment) return c.json({ error: "missing attachment" }, 400);

    const input = await base64ToBlob(attachment).catch(() => undefined);
    if (!input) return c.json({ error: "invalid attachment" }, 400);

    const blob = await client
      .call(ComAtprotoRepoUploadBlob, { input, signal: c.req.raw.signal })
      .catch(() => undefined);
    if (!blob?.ok) return c.json({ error: "failed to upload blob" }, 500);
    const tarballUrl = new URL(actor.pds);
    tarballUrl.pathname = "/xrpc/com.atproto.sync.getBlob";
    tarballUrl.searchParams.set("did", atcuteSession.did);
    tarballUrl.searchParams.set("cid", blob.data.blob.ref.$link);

    // TODO: fiture out why blob upload is hanging
    // TODO: Add versions with URL to uploaded blob on PDS for version.dist.tarball
    versions.unshift({
      $type: "dev.atpm.alpha.package#package",
      createdAt: new Date().toISOString(),
      version,
      blob: blob.data.blob,
      meta: {
        ...meta,
        dist: {
          ...meta.dist,
          tarball: tarballUrl.href,
        },
      },
    });
  }

  const record: DevAtpmPackage.Main = {
    $type: "dev.atpm.alpha.package",
    createdAt: new Date().toISOString(),
    type: "npm",
    tags: body["dist-tags"],
    versions,
  };

  const updated = await client.call(ComAtprotoRepoPutRecord, {
    input: {
      repo: atcuteSession.did,
      collection: "dev.atpm.alpha.package",
      rkey: name,
      record,
    },
  });

  if (!updated.ok) return c.json({ error: "failed to update record" }, 500);

  return c.json({ success: true });
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

app.get("/-/index", async (c) => {
  return c.json(await getCursor());
});

app.post("/-/index", async (c) => {
  const result = await indexEvent(await c.req.json());
  return c.json(result, 500);
});

app.get("*", (c) => {
  return proxyRequest(c);
});

function proxyRequest(c: Context, body?: BodyInit | null) {
  const url = new URL(c.req.url);
  const forwardedUrl = new URL(
    url.pathname.replace(/^\/registry\//, "/") + url.search,
    "https://registry.npmjs.org",
  );
  return fetch(forwardedUrl, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body,
  });
}

export default app;
