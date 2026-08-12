import "reflect-metadata";
import { Hono } from "hono";
import { expect, test, vi } from "vite-plus/test";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {},
}));

import registry from "./registry";

const STATEMENT = JSON.stringify({
  _type: "https://in-toto.io/Statement/v0.1",
  predicateType: "https://github.com/npm/attestation/tree/main/specs/publish/v0.1",
  subject: [],
  predicate: {},
});

const PROVENANCE = {
  mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
  verificationMaterial: {
    certificate: { rawBytes: "fake" },
    tlogEntries: [],
  },
  dsseEnvelope: {
    payload: Buffer.from(STATEMENT).toString("base64"),
    payloadType: "application/vnd.in-toto+json",
    signatures: [{ sig: "fake" }],
  },
};

function buildApp(options: { withAttestation?: boolean; resolveActor?: boolean } = {}) {
  const app = new Hono<{ Variables: { atcute: Record<string, unknown> } }>();

  app.use(async (c, next) => {
    c.set("atcute", {
      actorResolver: {
        resolve: async () =>
          options.resolveActor === false
            ? undefined
            : { did: "did:example:test", handle: "example" },
      },
      publicClientFor: async () => ({
        call: async () => ({
          ok: true,
          data: {
            value: {
              $type: "dev.atpm.alpha.package",
              createdAt: "2026-01-01T00:00:00.000Z",
              tags: { latest: "1.0.0" },
              versions: [
                {
                  version: "1.0.0",
                  createdAt: "2026-01-01T00:00:00.000Z",
                  meta:
                    options.withAttestation === false
                      ? undefined
                      : {
                          dist: {
                            shasum: "abc123",
                            tarball: "https://example.test/tarball.tgz",
                            attestations: {
                              url: "https://example.test/-/npm/v1/attestations/%40example%2Fpackage@1.0.0",
                              provenance: PROVENANCE,
                            },
                          },
                        },
                },
              ],
            },
          },
        }),
      }),
    });
    await next();
  });

  app.route("/", registry);
  return app;
}

test("serves attestations in the npm wrapped format", async () => {
  const res = await buildApp().request(
    "https://example.test/-/npm/v1/attestations/%40example%2Fpackage@1.0.0",
  );

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    attestations: [
      {
        predicateType: "https://github.com/npm/attestation/tree/main/specs/publish/v0.1",
        bundle: PROVENANCE,
      },
    ],
  });
});

test("404s when the actor cannot be resolved", async () => {
  const res = await buildApp({ resolveActor: false }).request(
    "https://example.test/-/npm/v1/attestations/%40example%2Fpackage@1.0.0",
  );

  expect(res.status).toBe(404);
});

test("404s when the version has no attestation", async () => {
  const res = await buildApp({ withAttestation: false }).request(
    "https://example.test/-/npm/v1/attestations/%40example%2Fpackage@1.0.0",
  );

  expect(res.status).toBe(404);
});

test("rejects an invalid spec", async () => {
  const res = await buildApp().request("https://example.test/-/npm/v1/attestations/nope");

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "invalid attestation spec" });
});
