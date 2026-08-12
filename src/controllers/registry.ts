import { type ActorIdentifier, type Handle } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import type * as npm from "@npm/types";
import { Context, Hono } from "hono";
import * as jose from "jose";
import { v5 as uuid } from "uuid";
import validatePackageName from "validate-npm-package-name";

import * as s from "@/db/schema";
import {
  ComAtprotoRepoCreateRecord,
  ComAtprotoRepoGetRecord,
  ComAtprotoRepoPutRecord,
  ComAtprotoRepoUploadBlob,
} from "@atcute/atproto";
import {
  DevAtpmAlphaPackage as DevAtpmPackage,
  DevAtpmAlphaStage as DevAtpmStage,
} from "@/lexicons";
import { base64ToBlob } from "@/lib/base64";
import {
  readCursor,
  indexEvent,
  readStagedPackages,
  readPublishers,
  rejectStaged,
  approveStaged,
} from "@/models/packages";
import { requireCliAuth } from "@/lib/auth";
import { AUTH_SESSION_TIMEOUT } from "@/models/cli-auth-session";

const app = new Hono<Env>();

app.get("/-/stage", requireCliAuth(), async (c) => {
  const atcute = c.get("atcute");

  const url = new URL(c.req.url);
  const packageName = url.searchParams.get("package");
  const page = Number.parseInt(url.searchParams.get("page") ?? "0");
  const perPage = Number.parseInt(url.searchParams.get("perPage") ?? "100");

  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(perPage))
    return c.json({ error: "page and perPage must be safe integers" }, 400);

  const staged = await readStagedPackages();

  const filtered = packageName ? staged.filter((pkg) => pkg.name === packageName) : staged;
  return c.json({
    page,
    perPage,
    total: filtered.length,
    items: filtered.slice(page * perPage, page * perPage + perPage).map((pkg) => ({
      id: uuid(pkg.uri + `/${pkg.cid}`, uuid.URL),
      packageName: pkg.name,
      version: pkg.version,
      tag: Object.keys(pkg.tags)[0],
      createdAt: pkg.createdAt,
      actor: atcute.session.did,
      actorType: "user",
      access: "public",
      shasum: (pkg.meta as npm.PackumentVersion).dist.shasum,
    })),
  });
});

app.post("/-/stage/package/:package", requireCliAuth({ "atpm:allowStage": true }), async (c) => {
  const atcute = c.get("atcute");
  const db = c.get("db");
  const packageParam = c.req.param("package");
  const [scope, name] = packageParam.split("/");
  const actor = await atcute.actorResolver.resolve(atcute.session.did).catch(() => null);

  if (!scope?.startsWith("@")) return c.json({ error: "package name must include @ scope" }, 400);
  if (!actor || scope.slice(1) !== actor.handle) {
    return c.json({ error: "scope does not match actor handle" }, 403);
  }
  if (atcute.restrictedToPackage && atcute.restrictedToPackage !== name) {
    return c.json({ error: "scope does not allow this package name" });
  }

  const body = (await c.req.json()) as npm.Packument & {
    _attachments: Record<
      string,
      {
        content_type: string;
        data: string;
        length: number;
      }
    >;
  };

  const existingPackage = await atcute.client.call(ComAtprotoRepoGetRecord, {
    params: {
      repo: atcute.session.did,
      collection: "dev.atpm.alpha.package",
      rkey: name,
    },
  });

  const versions: DevAtpmStage.Main[] = [];

  for (const [version, meta] of Object.entries(body.versions)) {
    if (
      existingPackage.ok &&
      (existingPackage.data.value as { versions: Record<string, unknown> }).versions[version]
    ) {
      return c.json({ error: "version already exists" }, 403);
    }

    const tarballName = `${scope}/${name}-${version}.tgz`;
    const attachment = body._attachments[tarballName];
    if (!attachment) return c.json({ error: "missing attachment" }, 400);

    const input = await base64ToBlob(attachment).catch(() => undefined);
    if (!input) return c.json({ error: "invalid attachment" }, 400);

    const blob = await atcute.client
      .call(ComAtprotoRepoUploadBlob, { input, signal: c.req.raw.signal })
      .catch(() => undefined);
    if (!blob?.ok) return c.json({ error: "failed to upload blob" }, 500);
    const tarballUrl = new URL(actor.pds);
    tarballUrl.pathname = "/xrpc/com.atproto.sync.getBlob";
    tarballUrl.searchParams.set("did", atcute.session.did);
    tarballUrl.searchParams.set("cid", blob.data.blob.ref.$link);

    versions.push({
      $type: "dev.atpm.alpha.stage",
      createdAt: new Date().toISOString(),
      name: `${scope}/${name}`,
      tags: body["dist-tags"],
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

  const created: (typeof s.stage.$inferInsert)[] = [];

  for (const version of versions) {
    const rkey = TID.now();
    const res = await atcute.client.call(ComAtprotoRepoCreateRecord, {
      input: {
        repo: atcute.session.did,
        collection: "dev.atpm.alpha.stage",
        rkey,
        record: version,
      },
    });
    if (!res.ok) return c.json({ error: res.data.message }, res.status as 500);
    created.push({
      createdAt: version.createdAt,
      did: atcute.session.did,
      rkey,
    });
  }

  await db.insert(s.stage).values(created).catch(console.error.bind(console));

  return c.json({ ok: true });
});

app.get("/-/stage/:stageId/tarball", requireCliAuth(), async (c) => {
  const stageId = c.req.param("stageId");
  const staged = await readStagedPackages();
  const pkg = staged.find((pkg) => stageId === uuid(pkg.uri + `/${pkg.cid}`, uuid.URL));
  if (!pkg) {
    return c.json(
      {
        error: "Not Found - No staged package version found with the provided ID.",
      },
      404,
    );
  }
  return fetch((pkg.meta as npm.PackumentVersion).dist.tarball);
});

app.post("/-/stage/:stageId/approve", requireCliAuth({ "atpm:allowPublish": true }), async (c) => {
  const stageId = c.req.param("stageId");

  const result = await approveStaged(stageId);
  if (!result.success) {
    return c.json({ error: result.error }, result.status as 400);
  }
  return c.json({ success: true });
});

app.get("/-/stage/:stageId", requireCliAuth(), async (c) => {
  const atcute = c.get("atcute");

  const stageId = c.req.param("stageId");

  const staged = await readStagedPackages();
  const pkg = staged.find((pkg) => stageId === uuid(pkg.uri + `/${pkg.cid}`, uuid.URL));
  if (!pkg) {
    return c.json(
      {
        error: "Not Found - No staged package version found with the provided ID.",
      },
      404,
    );
  }

  return c.json({
    id: uuid(pkg.uri + `/${pkg.cid}`, uuid.URL),
    packageName: pkg.name,
    version: pkg.version,
    tag: Object.keys(pkg.tags)[0],
    createdAt: pkg.createdAt,
    actor: atcute.session.did,
    actorType: "user",
    access: "public",
    shasum: (pkg.meta as npm.PackumentVersion).dist.shasum,
  });
});

app.delete("/-/stage/:stageId", requireCliAuth({ "atpm:allowStageDelete": true }), async (c) => {
  const stageId = c.req.param("stageId");

  const result = await rejectStaged(stageId);
  if (!result.success) {
    return c.json({ error: result.error }, result.status as 400);
  }
  return c.json({ success: true });
});

app.post("/-/v1/login", async (c) => {
  const sessionId = crypto.randomUUID();
  const session = c.env.CLI_AUTH_SESSION.getByName(sessionId);
  await session.setup();

  const loginUrl = new URL("/auth/login", c.req.url);
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

  const token = await new jose.SignJWT({
    "atpm:allowPublish": true,
    "atpm:allowStage": true,
    "atpm:allowStageDelete": true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(url.origin)
    .setSubject(sessionId)
    .setAudience(result.secret)
    .setExpirationTime(AUTH_SESSION_TIMEOUT / 1000 + "s")
    .sign(new TextEncoder().encode(c.env.SESSION_SECRET));

  return c.json({ token: `cli${token}` }, 200);
});

app.post("/-/npm/v1/oidc/token/exchange/package/:packageName", async (c) => {
  const atcute = c.get("atcute");
  const authorization = c.req.header("Authorization");
  if (!authorization) return c.json({ error: "no authorization header" }, 401);

  const packageName = c.req.param("packageName");
  const isValid = packageName.startsWith("@") && packageName.includes("/");
  if (!packageName || !validatePackageName(packageName).validForNewPackages || !isValid) {
    return c.json({ error: "invalid package name" }, 400);
  }
  const [handle, rkey] = packageName.slice(1).split("/");
  const actor = await atcute.actorResolver.resolve(handle as Handle).catch(() => null);
  if (!actor) return c.json({ error: "actor not found" }, 404);

  const publishers = await readPublishers(actor.did, rkey);
  console.log({ did: actor.did, rkey, publishers });
  if (!publishers?.github) return c.json({ error: "no publishers" }, 404);

  const url = new URL(c.req.url);
  const jwt = authorization.replace(/^Bearer\s+/, "");

  const verified = await jose
    .jwtVerify(
      jwt,
      jose.createRemoteJWKSet(
        new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
      ),
      {
        issuer: "https://token.actions.githubusercontent.com",
        audience: `npm:${url.host}`,
      },
    )
    .catch((err) => {
      console.error(err, (err as any).claim, (err as any).reason);
      return false as const;
    });

  if (!verified) {
    return c.json({ error: "invalid token" }, 401);
  }

  if (
    verified.payload.repository_owner !== publishers.github.username ||
    verified.payload.repository !==
      `${publishers.github.username}/${publishers.github.repository}` ||
    !(verified.payload.job_workflow_ref as string)?.startsWith?.(
      `${publishers.github.username}/${publishers.github.repository}/.github/workflows/${publishers.github.workflow}@`,
    )
  ) {
    return c.json({ error: "invalid token" }, 401);
  }

  const token = await new jose.SignJWT({
    "atpm:allowPublish": publishers.allowPublish,
    "atpm:allowStage": publishers.allowStage,
    "atpm:allowStageDelete": false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(url.origin)
    .setSubject(actor.did)
    .setAudience(rkey)
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(c.env.SESSION_SECRET));

  return c.json({ token: `ci${token}` }, 201);
});

app.get("/-/cli/:sessionId", async (c) => {
  const atcute = c.get("atcute");
  if (!atcute.session)
    return c.redirect(
      new URL(`/auth/login?error=${encodeURI("Failed to login: no session")}`, c.req.url),
    );
  const session = c.env.CLI_AUTH_SESSION.getByName(c.req.param("sessionId"));
  const result = await session.finish(atcute.session.did);
  if (result.state !== "done") {
    return c.redirect(
      new URL(`/auth/login?error=${encodeURI("Failed to login: invalid state")}`, c.req.url),
    );
  }
  return c.redirect(new URL("/auth/login?success", c.req.url));
});

app.get("/-/index", async (c) => {
  return c.json(await readCursor());
});

app.post("/-/index", async (c) => {
  if (c.req.header("Authorization") !== `Bearer ${c.env.INDEXER_SECRET}`) {
    return c.json({ error: "invalid authorization" }, 401);
  }
  const result = await indexEvent(await c.req.json());
  return c.json(result, result.success ? 200 : 500);
});

app.get("/-/package/:packageName/visibility", (c) => {
  return c.json({ public: true });
});

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

  const client = await atcute.publicClientFor(resolved.did);

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

app.put("/:package", requireCliAuth({ "atpm:allowPublish": true }), async (c) => {
  const atcute = c.get("atcute");
  const db = c.get("db");
  const packageParam = c.req.param("package");
  const [scope, name] = packageParam.split("/");
  if (!scope?.startsWith("@")) return c.json({ error: "package name must include @ scope" }, 400);
  if (atcute.restrictedToPackage && atcute.restrictedToPackage !== name) {
    return c.json({ error: "scope does not allow this package name" }, 403);
  }

  const actor = await atcute.actorResolver.resolve(atcute.session.did).catch(() => null);

  if (!actor || scope.slice(1) !== actor.handle) {
    return c.json({ error: "scope does not match actor handle" }, 403);
  }

  const body = (await c.req.json()) as npm.Packument & {
    _attachments: Record<
      string,
      {
        content_type: string;
        data: string;
        length: number;
      }
    >;
  };

  const existingPackage = await atcute.client.call(ComAtprotoRepoGetRecord, {
    params: {
      repo: atcute.session.did,
      collection: "dev.atpm.alpha.package",
      rkey: name,
    },
  });

  const versions: DevAtpmPackage.Package[] = existingPackage?.ok
    ? [...(existingPackage.data.value.versions as DevAtpmPackage.Package[])]
    : [];

  for (const [version, meta] of Object.entries(body.versions)) {
    if (versions.some((v) => v.version === version)) {
      return c.json({ error: "version already exists" }, 403);
    }

    const tarballName = `${scope}/${name}-${version}.tgz`;
    const attachment = body._attachments[tarballName];
    if (!attachment) return c.json({ error: "missing attachment" }, 400);

    const input = await base64ToBlob(attachment).catch(() => undefined);
    if (!input) return c.json({ error: "invalid attachment" }, 400);

    const blob = await atcute.client
      .call(ComAtprotoRepoUploadBlob, { input, signal: c.req.raw.signal })
      .catch(() => undefined);
    if (!blob?.ok) return c.json({ error: "failed to upload blob" }, 500);
    const tarballUrl = new URL(actor.pds);
    tarballUrl.pathname = "/xrpc/com.atproto.sync.getBlob";
    tarballUrl.searchParams.set("did", atcute.session.did);
    tarballUrl.searchParams.set("cid", blob.data.blob.ref.$link);

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
    tags: {
      ...(existingPackage.ok
        ? (existingPackage.data.value as { tags?: Record<string, string> }).tags
        : undefined),
      ...body["dist-tags"],
    },
    versions,
  };

  const updated = await atcute.client.call(ComAtprotoRepoPutRecord, {
    input: {
      repo: atcute.session.did,
      collection: "dev.atpm.alpha.package",
      rkey: name,
      record,
    },
  });

  if (!updated.ok) return c.json({ error: "failed to update record" }, 500);

  const indexedAt = new Date().toISOString();
  await db
    .insert(s.pkg)
    .values({
      createdAt: record.createdAt,
      did: atcute.session.did,
      rkey: name,
    })
    .onConflictDoUpdate({
      target: [s.pkg.did, s.pkg.rkey],
      set: {
        indexedAt,
      },
    })
    .catch(console.error.bind(console));

  return c.json({ success: true });
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
