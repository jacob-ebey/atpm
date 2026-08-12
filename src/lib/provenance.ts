import { Extension, X509Certificate, X509ChainBuilder } from "@peculiar/x509";

/**
 * Sigstore bundle (v0.1 / v0.2) as attached by `npm publish --provenance`.
 * https://github.com/sigstore/protobuf-specs/blob/main/protos/sigstore_bundle.proto
 */
export interface SigstoreBundle {
  mediaType: string;
  verificationMaterial: {
    certificate?: { rawBytes: string };
    certificateChain?: { certificates: { rawBytes: string }[] };
    content?: {
      certificate?: { rawBytes: string };
      x509CertificateChain?: { certificates: { rawBytes: string }[] };
    };
    tlogEntries?: {
      logIndex: string | number;
      integratedTime?: string;
      [key: string]: unknown;
    }[];
  };
  dsseEnvelope: {
    payload: string;
    payloadType: string;
    signatures: { sig: string; keyid?: string }[];
  };
}

export type ProvenanceAttestation = {
  url: string;
  provenance: SigstoreBundle;
};

// Fulcio extensions (https://github.com/sigstore/fulcio/blob/main/docs/oid-info.md)
export const OID_ISSUER = "1.3.6.1.4.1.57264.1.8";
export const OID_RUNNER_ENVIRONMENT = "1.3.6.1.4.1.57264.1.11";
export const OID_SOURCE_REPO_URI = "1.3.6.1.4.1.57264.1.12";
export const OID_SOURCE_REPO_DIGEST = "1.3.6.1.4.1.57264.1.13";
export const OID_SOURCE_REPO_REF = "1.3.6.1.4.1.57264.1.14";
export const OID_RUN_INVOCATION_URI = "1.3.6.1.4.1.57264.1.21";
export const OID_SOURCE_REPO_VISIBILITY = "1.3.6.1.4.1.57264.1.22";

export const GITHUB_ACTIONS_ISSUER = "https://token.actions.githubusercontent.com";

const IN_TOTO_STATEMENT_V01 = "https://in-toto.io/Statement/v0.1";
const IN_TOTO_STATEMENT_V1 = "https://in-toto.io/Statement/v1";
const INTOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json";

const BUNDLE_V01 = "application/vnd.dev.sigstore.bundle.v0.1+json";
const BUNDLE_V02 = "application/vnd.dev.sigstore.bundle.v0.2+json";
const BUNDLE_V03 = "application/vnd.dev.sigstore.bundle.v0.3+json";

// https://fulcio.sigstore.dev/api/v1/rootCert
const FULCIO_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIIB9zCCAXygAwIBAgIUALZNAPFdxHPwjeDloDwyYChAO/4wCgYIKoZIzj0EAwMw
KjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MREwDwYDVQQDEwhzaWdzdG9yZTAeFw0y
MTEwMDcxMzU2NTlaFw0zMTEwMDUxMzU2NThaMCoxFTATBgNVBAoTDHNpZ3N0b3Jl
LmRldjERMA8GA1UEAxMIc2lnc3RvcmUwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAT7
XeFT4rb3PQGwS4IajtLk3/OlnpgangaBclYpsYBr5i+4ynB07ceb3LP0OIOZdxex
X69c5iVuyJRQ+Hz05yi+UF3uBWAlHpiS5sh0+H2GHE7SXrk1EC5m1Tr19L9gg92j
YzBhMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRY
wB5fkUWlZql6zJChkyLQKsXF+jAfBgNVHSMEGDAWgBRYwB5fkUWlZql6zJChkyLQ
KsXF+jAKBggqhkjOPQQDAwNpADBmAjEAj1nHeXZp+13NWBNa+EDsDP8G1WWg1tCM
WP/WHPqpaVo0jhsweNFZgSs0eE7wYI4qAjEA2WB9ot98sIkoF3vZYdd3/VtWB5b9
TNMea7Ix/stJ5TfcLLeABLE4BNJOsQ4vnBHJ
-----END CERTIFICATE-----`;

// https://fulcio.sigstore.dev/api/v1/rootCert
const FULCIO_INTERMEDIATE_PEM = `-----BEGIN CERTIFICATE-----
MIICGjCCAaGgAwIBAgIUALnViVfnU0brJasmRkHrn/UnfaQwCgYIKoZIzj0EAwMw
KjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MREwDwYDVQQDEwhzaWdzdG9yZTAeFw0y
MjA0MTMyMDA2MTVaFw0zMTEwMDUxMzU2NThaMDcxFTATBgNVBAoTDHNpZ3N0b3Jl
LmRldjEeMBwGA1UEAxMVc2lnc3RvcmUtaW50ZXJtZWRpYXRlMHYwEAYHKoZIzj0C
AQYFK4EEACIDYgAE8RVS/ysH+NOvuDZyPIZtilgUF9NlarYpAd9HP1vBBH1U5CV7
7LSS7s0ZiH4nE7Hv7ptS6LvvR/STk798LVgMzLlJ4HeIfF3tHSaexLcYpSASr1kS
0N/RgBJz/9jWCiXno3sweTAOBgNVHQ8BAf8EBAMCAQYwEwYDVR0lBAwwCgYIKwYB
BQUHAwMwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQU39Ppz1YkEZb5qNjp
KFWixi4YZD8wHwYDVR0jBBgwFoAUWMAeX5FFpWapesyQoZMi0CrFxfowCgYIKoZI
zj0EAwMDZwAwZAIwPCsQK4DYiZYDPIaDi5HFKnfxXx6ASSVmERfsynYBiX2X6SJR
nZU84/9DZdnFvvxmAjBOt6QpBlc4J/0DxvkTCqpclvziL6BCCPnjdlIB3Pu3BxsP
mygUY7Ii2zbdCdliiow=
-----END CERTIFICATE-----`;

export type VerifiedProvenance = {
  bundle: SigstoreBundle;
  issuer: string;
  sourceRepositoryUri: string | undefined;
  sourceRepositoryDigest: string | undefined;
  sourceRepositoryRef: string | undefined;
  runInvocationUri: string | undefined;
  transparencyLogUrl: string | undefined;
};

export type ProvenanceStatement = {
  _type: string;
  subject: { name: string; digest?: Record<string, string> }[];
  predicate: Record<string, unknown> | undefined;
};

export async function verifyProvenance(
  bundle: SigstoreBundle,
  expected: {
    name: string;
    version: string;
    sha512Hex: string;
    github?: { username: string; repository: string };
  },
  trustAnchors: string[] = [FULCIO_ROOT_PEM],
): Promise<VerifiedProvenance> {
  if (!bundle.mediaType || ![BUNDLE_V01, BUNDLE_V02, BUNDLE_V03].includes(bundle.mediaType)) {
    throw new Error(`unsupported bundle media type: ${bundle.mediaType}`);
  }

  const material = bundle.verificationMaterial;
  if (!material || !bundle.dsseEnvelope) {
    throw new Error("invalid provenance bundle: missing verification material");
  }

  const certBase64 =
    material.certificate?.rawBytes ??
    material.content?.certificate?.rawBytes ??
    material.content?.x509CertificateChain?.certificates?.[0]?.rawBytes;
  if (!certBase64) {
    throw new Error("invalid provenance bundle: no signing certificate");
  }

  const leaf = new X509Certificate(fromBase64(certBase64));

  const chainCerts =
    material.certificateChain?.certificates ?? material.content?.x509CertificateChain?.certificates;
  const pool = [
    ...(chainCerts ?? []).map((c) => c.rawBytes).map((raw) => new X509Certificate(fromBase64(raw))),
    new X509Certificate(pemToDer(FULCIO_INTERMEDIATE_PEM)),
    ...trustAnchors.map((pem) => new X509Certificate(pemToDer(pem))),
  ];

  let chain: X509Certificate[];
  try {
    chain = [...(await new X509ChainBuilder({ certificates: pool }).build(leaf))];
  } catch (error) {
    throw new Error(`invalid provenance certificate chain: ${(error as Error).message}`);
  }

  const root = chain[chain.length - 1];
  const trustedRoots = trustAnchors.map((pem) => new X509Certificate(pemToDer(pem)));
  if (!trustedRoots.some((trusted) => equalBytes(trusted.rawData, root.rawData))) {
    throw new Error("invalid provenance certificate chain: does not chain to the trusted root");
  }

  const signingTime = tlogIntegratedTime(material.tlogEntries);
  const now = new Date();
  for (let i = 0; i < chain.length; i++) {
    const cert = chain[i];
    // Fulcio leaf certificates are short-lived (GitHub Actions certs are
    // valid for ~10 minutes). A staged package may be approved long after
    // the bundle was signed, so the leaf's validity must be evaluated at
    // the time of signing — as established by the transparency log entry —
    // rather than at approval time. Long-lived intermediates and roots are
    // still checked against the current time.
    const reference = i === 0 ? (signingTime ?? now) : now;
    if (reference < cert.notBefore || reference > cert.notAfter) {
      throw new Error("invalid provenance certificate chain: certificate validity expired");
    }
  }

  const envelope = bundle.dsseEnvelope;
  const payload = fromBase64(envelope.payload);
  const payloadType = envelope.payloadType || INTOTO_PAYLOAD_TYPE;
  const signature = envelope.signatures?.[0]?.sig;
  if (!signature) {
    throw new Error("invalid provenance bundle: missing signature");
  }

  const prefix = `DSSEv1 ${payloadType.length} ${payloadType} ${payload.length} `;
  const prefixBytes = new TextEncoder().encode(prefix);
  const pae = new Uint8Array(prefixBytes.length + payload.length);
  pae.set(prefixBytes, 0);
  pae.set(payload, prefixBytes.length);

  const publicKey = await leaf.publicKey.export();
  const signatureBytes = fromBase64(signature);
  const verified = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    derToRawSignature(signatureBytes),
    pae,
  );
  if (!verified) {
    throw new Error(
      `invalid provenance bundle signature (length ${signatureBytes.length}, DER: ${signatureBytes[0] === 0x30})`,
    );
  }

  let statement: ProvenanceStatement;
  try {
    statement = JSON.parse(new TextDecoder().decode(payload)) as ProvenanceStatement;
  } catch {
    throw new Error("invalid provenance bundle payload");
  }

  if (![IN_TOTO_STATEMENT_V01, IN_TOTO_STATEMENT_V1].includes(statement._type)) {
    throw new Error(`unsupported in-toto statement type: ${statement._type}`);
  }
  if (!Array.isArray(statement.subject) || statement.subject.length !== 1) {
    throw new Error("invalid provenance: expected exactly one subject");
  }

  const subject = statement.subject[0];
  const purl = toPurl(expected.name, expected.version);
  if (subject.name !== purl) {
    throw new Error(`provenance subject ${subject.name} does not match ${purl}`);
  }
  if (subject.digest?.sha512 !== expected.sha512Hex) {
    throw new Error("provenance subject digest does not match the tarball");
  }

  const issuer = getStringExtension(leaf, OID_ISSUER);
  if (issuer !== GITHUB_ACTIONS_ISSUER) {
    throw new Error(`unsupported provenance issuer: ${issuer}`);
  }

  const runnerEnvironment = getStringExtension(leaf, OID_RUNNER_ENVIRONMENT);
  if (runnerEnvironment !== "github-hosted") {
    throw new Error(
      `provenance must be generated on a github-hosted runner, got: ${runnerEnvironment}`,
    );
  }

  const visibility = getStringExtension(leaf, OID_SOURCE_REPO_VISIBILITY);
  if (visibility !== "public") {
    throw new Error(`provenance must be generated from a public repository, got: ${visibility}`);
  }

  const sourceRepositoryUri = getStringExtension(leaf, OID_SOURCE_REPO_URI);
  if (expected.github) {
    const match = matchGithubRepository(sourceRepositoryUri, expected.github);
    if (!match) {
      throw new Error("provenance source repository does not match the trusted publisher");
    }
  }

  const logIndex = bundle.verificationMaterial.tlogEntries?.[0]?.logIndex;

  return {
    bundle,
    issuer,
    sourceRepositoryUri,
    sourceRepositoryDigest: getStringExtension(leaf, OID_SOURCE_REPO_DIGEST),
    sourceRepositoryRef: getStringExtension(leaf, OID_SOURCE_REPO_REF),
    runInvocationUri: getStringExtension(leaf, OID_RUN_INVOCATION_URI),
    transparencyLogUrl:
      typeof logIndex === "string" || typeof logIndex === "number"
        ? `https://search.sigstore.dev/?logIndex=${logIndex}`
        : undefined,
  };
}

/**
 * npm-package-arg's `toPurl`: https://github.com/npm/npm-package-arg
 */
export function toPurl(name: string, version: string): string {
  return `pkg:npm/${name.replace(/^@/, "%40")}@${version}`;
}

export function parseProvenanceStatement(bundle: SigstoreBundle): ProvenanceStatement {
  const payload = fromBase64(bundle.dsseEnvelope.payload);
  return JSON.parse(new TextDecoder().decode(payload)) as ProvenanceStatement;
}

export function provenanceInfo(bundle: SigstoreBundle) {
  const statement = parseProvenanceStatement(bundle);
  const predicate: Record<string, any> = statement.predicate ?? {};

  const workflow = predicate.buildDefinition?.externalParameters?.workflow;
  const invocations:
    | {
        uri?: string;
        digest?: Record<string, string>;
      }
    | undefined = predicate.invocation?.configSource;

  const dependencies = predicate.buildDefinition?.resolvedDependencies ?? predicate.materials;
  const gitCommit = Array.isArray(dependencies)
    ? (dependencies[0]?.digest?.gitCommit ?? dependencies[0]?.digest?.sha1)
    : undefined;

  const logIndex = bundle.verificationMaterial.tlogEntries?.[0]?.logIndex;

  return {
    repository: workflow?.repository ?? invocations?.uri?.replace(/^git\+/, ""),
    ref: workflow?.ref ?? invocations?.digest?.sha1,
    gitCommit,
    invocationId:
      predicate.runDetails?.metadata?.invocationId ?? predicate.metadata?.buildInvocationId,
    logIndex: typeof logIndex === "string" || typeof logIndex === "number" ? logIndex : undefined,
  };
}

function matchGithubRepository(
  uri: string | undefined,
  github: { username: string; repository: string },
): boolean {
  if (!uri) return false;
  try {
    const url = new URL(uri);
    if (url.hostname !== "github.com") return false;
    const [owner, repository, ...rest] = url.pathname.split("/").filter(Boolean);
    if (rest.length > 0) return false;
    return owner === github.username && repository === github.repository;
  } catch {
    return false;
  }
}

/**
 * The time the bundle's signature was included in the transparency log,
 * serialized as an RFC3339 timestamp per the protobuf JSON mapping. This
 * establishes when the signing certificate was used.
 */
function tlogIntegratedTime(
  entries: SigstoreBundle["verificationMaterial"]["tlogEntries"],
): Date | undefined {
  const raw = entries?.[0]?.integratedTime;
  if (typeof raw !== "string") return undefined;
  const time = new Date(raw);
  return Number.isNaN(time.getTime()) ? undefined : time;
}

function getStringExtension(cert: X509Certificate, oid: string): string | undefined {
  const extension: Extension | null = cert.getExtension(oid);
  if (!extension) return undefined;

  const value = new Uint8Array(extension.value);
  if (value.length === 0) return undefined;

  // 1.3.6.1.4.1.57264.1.8 through 1.24 are DER-encoded strings (UTF8String tag 0x0c).
  const decoded = decodeAsn1String(value);
  return new TextDecoder().decode(decoded ?? value);
}

function decodeAsn1String(value: Uint8Array): Uint8Array | undefined {
  if (value.length < 2) return undefined;

  const tag = value[0];
  if (tag !== 0x0c && tag !== 0x16) return undefined;

  const second = value[1];
  let header = 2;
  let length = second & 0x7f;
  if (second & 0x80) {
    const lengthOfLength = second & 0x7f;
    if (lengthOfLength === 0 || 2 + lengthOfLength > value.length) return undefined;
    length = 0;
    for (let i = 0; i < lengthOfLength; i++) {
      length = length * 256 + value[2 + i];
    }
    header = 2 + lengthOfLength;
  }

  if (header + length > value.length) return undefined;
  return value.subarray(header, header + length);
}

function fromBase64(input: string): Uint8Array<ArrayBuffer> {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function decodeBase64(input: string): Uint8Array<ArrayBuffer> {
  return fromBase64(input);
}

export function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  return fromBase64(base64);
}

function equalBytes(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  for (let i = 0; i < va.length; i++) {
    if (va[i] !== vb[i]) return false;
  }
  return true;
}

/**
 * Normalizes an ECDSA signature to raw r||s form for `crypto.subtle.verify`.
 * npm's sigstore signer produces DER-encoded signatures (via Node's
 * `crypto.sign`), which WebCrypto rejects. Bundles signed in raw form are
 * returned unchanged.
 */
function derToRawSignature(input: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (input.length < 8 || input[0] !== 0x30) return input;

  let offset = 1;
  const readLength = (): number => {
    const first = input[offset];
    offset += 1;
    if (!(first & 0x80)) return first;
    const lengthBytes = first & 0x7f;
    let length = 0;
    for (let i = 0; i < lengthBytes; i++) {
      length = length * 256 + input[offset];
      offset += 1;
    }
    return length;
  };

  const readInteger = (): Uint8Array | undefined => {
    if (input[offset] !== 0x02) return undefined;
    offset += 1;
    const length = readLength();
    const end = offset + length;
    if (end > input.length) return undefined;
    let start = offset;
    while (start < end - 1 && input[start] === 0) start += 1;
    const value = input.subarray(start, end);
    if (value.length > 32) return undefined;
    const out = new Uint8Array(32);
    out.set(value, 32 - value.length);
    offset = end;
    return out;
  };

  readLength();
  const r = readInteger();
  const s = readInteger();
  if (!r || !s) return input;

  const out = new Uint8Array(64);
  out.set(r, 0);
  out.set(s, 32);
  return out;
}
