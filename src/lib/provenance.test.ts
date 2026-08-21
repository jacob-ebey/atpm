import "reflect-metadata";
import { createPrivateKey, sign, type JsonWebKeyInput } from "node:crypto";
import {
  BasicConstraintsExtension,
  Extension,
  KeyUsageFlags,
  KeyUsagesExtension,
  X509CertificateGenerator,
} from "@peculiar/x509";
import { expect, test } from "vite-plus/test";

import {
  OID_ISSUER,
  OID_RUNNER_ENVIRONMENT,
  OID_SOURCE_REPO_URI,
  OID_SOURCE_REPO_VISIBILITY,
  provenanceInfo,
  toPurl,
  verifyProvenance,
  type ProvenanceStatement,
  type SigstoreBundle,
} from "./provenance";

const INTOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json";

const SHA512 = "ab".repeat(64);

function utf8String(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  const out = new Uint8Array(2 + bytes.length);
  out[0] = 0x0c;
  out[1] = bytes.length;
  out.set(bytes, 2);
  return out.buffer;
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < u8.length; i++) {
    binary += String.fromCharCode(u8[i]);
  }
  return btoa(binary);
}

async function createChain(
  overrides: {
    visibility?: string;
    issuer?: string;
    runner?: string;
    leafNotBefore?: Date;
    leafNotAfter?: Date;
  } = {},
) {
  const rootKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const intermediateKeys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const leafKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);

  const root = await X509CertificateGenerator.createSelfSigned({
    name: "CN=sigstore",
    keys: rootKeys,
    notBefore: new Date(Date.now() - 1000 * 60),
    notAfter: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    extensions: [
      new BasicConstraintsExtension(true, undefined, true),
      new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
    ],
  });

  const intermediate = await X509CertificateGenerator.create({
    serialNumber: "01",
    subject: "CN=sigstore-intermediate",
    issuer: root.subject,
    notBefore: new Date(Date.now() - 1000 * 60),
    notAfter: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    publicKey: intermediateKeys.publicKey,
    signingKey: rootKeys.privateKey,
    signingAlgorithm: { name: "ECDSA", hash: "SHA-256" },
    extensions: [
      new BasicConstraintsExtension(true, undefined, true),
      new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
    ],
  });

  const leaf = await X509CertificateGenerator.create({
    serialNumber: "02",
    subject: "CN=sigstore",
    issuer: intermediate.subject,
    notBefore: overrides.leafNotBefore ?? new Date(Date.now() - 1000 * 60),
    notAfter: overrides.leafNotAfter ?? new Date(Date.now() + 1000 * 60 * 10),
    publicKey: leafKeys.publicKey,
    signingKey: intermediateKeys.privateKey,
    signingAlgorithm: { name: "ECDSA", hash: "SHA-256" },
    extensions: [
      new BasicConstraintsExtension(false, undefined, true),
      new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
      new Extension(
        OID_ISSUER,
        false,
        utf8String(overrides.issuer ?? "https://token.actions.githubusercontent.com"),
      ),
      new Extension(OID_RUNNER_ENVIRONMENT, false, utf8String(overrides.runner ?? "github-hosted")),
      new Extension(OID_SOURCE_REPO_URI, false, utf8String("https://github.com/example/package")),
      new Extension(
        OID_SOURCE_REPO_VISIBILITY,
        false,
        utf8String(overrides.visibility ?? "public"),
      ),
    ],
  });

  return {
    root,
    intermediate,
    leaf,
    signingKey: leafKeys.privateKey,
  };
}

function makeStatement(): ProvenanceStatement {
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: toPurl("@example/package", "1.0.0"), digest: { sha512: SHA512 } }],
    predicate: {
      buildDefinition: {
        buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
        externalParameters: {
          workflow: {
            ref: "refs/tags/v1.0.0",
            repository: "https://github.com/example/package",
            path: ".github/workflows/publish.yml",
          },
        },
        resolvedDependencies: [
          {
            uri: "git+https://github.com/example/package@refs/tags/v1.0.0",
            digest: { gitCommit: "0123456789abcdef" },
          },
        ],
      },
      runDetails: {
        builder: { id: "https://github.com/actions/runner/github-hosted" },
        metadata: {
          invocationId: "https://github.com/example/package/actions/runs/1/attempts/1",
        },
      },
    },
  };
}

async function signBundle(bundle: SigstoreBundle, signingKey: CryptoKey): Promise<SigstoreBundle> {
  const payload = base64ToBytes(bundle.dsseEnvelope.payload);
  const prefix = `DSSEv1 ${INTOTO_PAYLOAD_TYPE.length} ${INTOTO_PAYLOAD_TYPE} ${payload.length} `;
  const prefixBytes = new TextEncoder().encode(prefix);
  const pae = new Uint8Array(prefixBytes.length + payload.length);
  pae.set(prefixBytes, 0);
  pae.set(payload, prefixBytes.length);

  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, pae);
  return {
    ...bundle,
    dsseEnvelope: {
      ...bundle.dsseEnvelope,
      signatures: [{ sig: bytesToBase64(signature), keyid: "" }],
    },
  };
}

function base64ToBytes(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function makeBundle({
  leaf,
  intermediate,
  signingKey,
  statement = makeStatement(),
  useV01 = false,
  mediaType = "application/vnd.dev.sigstore.bundle.v0.2+json",
  integratedTime,
}: {
  leaf: Awaited<ReturnType<typeof createChain>>["leaf"];
  intermediate: Awaited<ReturnType<typeof createChain>>["intermediate"];
  signingKey: CryptoKey;
  statement?: ProvenanceStatement;
  useV01?: boolean;
  mediaType?: string;
  integratedTime?: string;
}): Promise<SigstoreBundle> {
  const tlogEntries = [{ logIndex: 42, ...(integratedTime ? { integratedTime } : {}) }];
  const bundle: SigstoreBundle = {
    mediaType,
    verificationMaterial: useV01
      ? {
          content: {
            x509CertificateChain: {
              certificates: [
                { rawBytes: bytesToBase64(leaf.rawData) },
                { rawBytes: bytesToBase64(intermediate.rawData) },
              ],
            },
          },
          tlogEntries,
        }
      : {
          certificate: { rawBytes: bytesToBase64(leaf.rawData) },
          certificateChain: {
            certificates: [{ rawBytes: bytesToBase64(intermediate.rawData) }],
          },
          tlogEntries,
        },
    dsseEnvelope: {
      payloadType: INTOTO_PAYLOAD_TYPE,
      payload: bytesToBase64(new TextEncoder().encode(JSON.stringify(statement))),
      signatures: [],
    },
  };

  return signBundle(bundle, signingKey);
}

test("toPurl encodes scoped package names", () => {
  expect(toPurl("@example/package", "1.0.0")).toBe("pkg:npm/%40example/package@1.0.0");
  expect(toPurl("package", "1.0.0")).toBe("pkg:npm/package@1.0.0");
});

test("verifies a valid provenance bundle", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain();
  const bundle = await makeBundle({ leaf, intermediate, signingKey });

  const result = await verifyProvenance(
    bundle,
    {
      name: "@example/package",
      version: "1.0.0",
      sha512Hex: SHA512,
      github: { username: "example", repository: "package" },
    },
    [root.toString("pem")],
  );

  expect(result.transparencyLogUrl).toBe("https://search.sigstore.dev/?logIndex=42");
  expect(result.sourceRepositoryUri).toBe("https://github.com/example/package");
});

test("verifies a v0.1 bundle", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain();
  const bundle = await makeBundle({ leaf, intermediate, signingKey, useV01: true });

  await expect(
    verifyProvenance(bundle, { name: "@example/package", version: "1.0.0", sha512Hex: SHA512 }, [
      root.toString("pem"),
    ]),
  ).resolves.toMatchObject({ transparencyLogUrl: "https://search.sigstore.dev/?logIndex=42" });
});

test("verifies a v0.3 bundle", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain();
  const bundle = await makeBundle({
    leaf,
    intermediate,
    signingKey,
    mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
  });

  await expect(
    verifyProvenance(bundle, { name: "@example/package", version: "1.0.0", sha512Hex: SHA512 }, [
      root.toString("pem"),
    ]),
  ).resolves.toMatchObject({ transparencyLogUrl: "https://search.sigstore.dev/?logIndex=42" });
});

test("verifies provenance when the leaf certificate has expired since signing", async () => {
  const signingTime = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const { root, intermediate, leaf, signingKey } = await createChain({
    leafNotBefore: new Date(signingTime.getTime() - 1000 * 60),
    leafNotAfter: new Date(signingTime.getTime() + 1000 * 60 * 10),
  });
  const bundle = await makeBundle({
    leaf,
    intermediate,
    signingKey,
    // real bundles carry unix epoch seconds per the protobuf JSON mapping
    integratedTime: String(Math.floor(signingTime.getTime() / 1000)),
  });

  await expect(
    verifyProvenance(bundle, { name: "@example/package", version: "1.0.0", sha512Hex: SHA512 }, [
      root.toString("pem"),
    ]),
  ).resolves.toMatchObject({ transparencyLogUrl: "https://search.sigstore.dev/?logIndex=42" });
});

test("rejects when the leaf certificate was not valid at signing time", async () => {
  const signingTime = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const { root, intermediate, leaf, signingKey } = await createChain({
    leafNotBefore: new Date(signingTime.getTime() + 1000 * 60),
  });
  const bundle = await makeBundle({
    leaf,
    intermediate,
    signingKey,
    integratedTime: String(Math.floor(signingTime.getTime() / 1000)),
  });

  await expect(
    verifyProvenance(bundle, { name: "@example/package", version: "1.0.0", sha512Hex: SHA512 }, [
      root.toString("pem"),
    ]),
  ).rejects.toThrow(/validity expired/);
});

test("rejects when the subject digest does not match the tarball", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain();
  const bundle = await makeBundle({ leaf, intermediate, signingKey });

  await expect(
    verifyProvenance(
      bundle,
      { name: "@example/package", version: "1.0.0", sha512Hex: "cd".repeat(64) },
      [root.toString("pem")],
    ),
  ).rejects.toThrow(/digest/);
});

test("rejects when the subject name does not match the package", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain();
  const bundle = await makeBundle({ leaf, intermediate, signingKey });

  await expect(
    verifyProvenance(bundle, { name: "@other/package", version: "1.0.0", sha512Hex: SHA512 }, [
      root.toString("pem"),
    ]),
  ).rejects.toThrow(/does not match/);
});

test("rejects a bundle signed by a different key", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain();
  const rogueKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const bundle = await makeBundle({
    leaf,
    intermediate,
    signingKey,
  });
  const tampered = await signBundle(bundle, rogueKeys.privateKey);

  await expect(
    verifyProvenance(tampered, { name: "@example/package", version: "1.0.0", sha512Hex: SHA512 }, [
      root.toString("pem"),
    ]),
  ).rejects.toThrow(/signature/);
});

test("verifies a DER-encoded signature as produced by npm's sigstore signer", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain();
  const bundle = await makeBundle({ leaf, intermediate, signingKey });

  const payload = base64ToBytes(bundle.dsseEnvelope.payload);
  const prefix = `DSSEv1 ${INTOTO_PAYLOAD_TYPE.length} ${INTOTO_PAYLOAD_TYPE} ${payload.length} `;
  const pae = new Uint8Array([...new TextEncoder().encode(prefix), ...payload]);
  const jwk = await crypto.subtle.exportKey("jwk", signingKey);
  const der = sign("sha256", pae, createPrivateKey({ key: jwk, format: "jwk" } as JsonWebKeyInput));
  const signed = {
    ...bundle,
    dsseEnvelope: {
      ...bundle.dsseEnvelope,
      signatures: [{ sig: bytesToBase64(der), keyid: "" }],
    },
  };

  await expect(
    verifyProvenance(signed, { name: "@example/package", version: "1.0.0", sha512Hex: SHA512 }, [
      root.toString("pem"),
    ]),
  ).resolves.toMatchObject({ transparencyLogUrl: "https://search.sigstore.dev/?logIndex=42" });
});

test("rejects when the chain does not reach a trusted root", async () => {
  const { intermediate, leaf, signingKey } = await createChain();
  const bundle = await makeBundle({ leaf, intermediate, signingKey });

  await expect(
    verifyProvenance(bundle, { name: "@example/package", version: "1.0.0", sha512Hex: SHA512 }, []),
  ).rejects.toThrow(/trusted root/);
});

test("rejects provenance from a private repository", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain({
    visibility: "private",
  });
  const bundle = await makeBundle({ leaf, intermediate, signingKey });

  await expect(
    verifyProvenance(bundle, { name: "@example/package", version: "1.0.0", sha512Hex: SHA512 }, [
      root.toString("pem"),
    ]),
  ).rejects.toThrow(/public repository/);
});

test("rejects an unsupported issuer", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain({
    issuer: "https://example.com/issuer",
  });
  const bundle = await makeBundle({ leaf, intermediate, signingKey });

  await expect(
    verifyProvenance(bundle, { name: "@example/package", version: "1.0.0", sha512Hex: SHA512 }, [
      root.toString("pem"),
    ]),
  ).rejects.toThrow(/issuer/);
});

test("rejects a non-github-hosted runner", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain({
    runner: "self-hosted",
  });
  const bundle = await makeBundle({ leaf, intermediate, signingKey });

  await expect(
    verifyProvenance(bundle, { name: "@example/package", version: "1.0.0", sha512Hex: SHA512 }, [
      root.toString("pem"),
    ]),
  ).rejects.toThrow(/github-hosted runner/);
});

test("rejects when the source repository does not match the trusted publisher", async () => {
  const { root, intermediate, leaf, signingKey } = await createChain();
  const bundle = await makeBundle({ leaf, intermediate, signingKey });

  await expect(
    verifyProvenance(
      bundle,
      {
        name: "@example/package",
        version: "1.0.0",
        sha512Hex: SHA512,
        github: { username: "someone-else", repository: "package" },
      },
      [root.toString("pem")],
    ),
  ).rejects.toThrow(/trusted publisher/);
});

test("provenanceInfo extracts build metadata", async () => {
  const { intermediate, leaf, signingKey } = await createChain();
  const bundle = await makeBundle({ leaf, intermediate, signingKey });

  expect(provenanceInfo(bundle)).toMatchObject({
    repository: "https://github.com/example/package",
    ref: "refs/tags/v1.0.0",
    gitCommit: "0123456789abcdef",
    invocationId: "https://github.com/example/package/actions/runs/1/attempts/1",
    logIndex: 42,
  });
});
