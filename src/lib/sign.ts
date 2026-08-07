declare global {
  interface SubtleCrypto {
    timingSafeEqual(a: BufferSource, b: BufferSource): boolean;
  }
}

type ValidationResult = { ok: true; value: string } | { ok: false };

function strToUint8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function uint8ToStr(uint8: Uint8Array): string {
  return new TextDecoder().decode(uint8);
}

function uint8ToBase64url(uint8: Uint8Array): string {
  const binary = String.fromCharCode(...uint8);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToUint8(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const keyCache = new Map<string, CryptoKey>();

async function getSecretKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const keyData = strToUint8(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  keyCache.set(secret, key);
  return key;
}

export async function sign(value: string, secret: string): Promise<string> {
  const key = await getSecretKey(secret);
  const data = strToUint8(value);
  const signature = await crypto.subtle.sign("HMAC", key, data as BufferSource);
  const sigBytes = new Uint8Array(signature);
  const encodedValue = uint8ToBase64url(data);
  const encodedSig = uint8ToBase64url(sigBytes);
  return `${encodedValue}.${encodedSig}`;
}

export async function validate(signed: string, secret: string): Promise<ValidationResult> {
  const parts = signed.split(".");
  if (parts.length !== 2) {
    return { ok: false };
  }
  const [encodedValue, encodedSig] = parts;
  try {
    const valueBytes = base64urlToUint8(encodedValue);
    const sigBytes = base64urlToUint8(encodedSig);
    const key = await getSecretKey(secret);
    const signature = await crypto.subtle.sign("HMAC", key, valueBytes as BufferSource);
    const computedSig = new Uint8Array(signature);
    if (computedSig.length !== sigBytes.length) {
      return { ok: false };
    }
    const valid = crypto.subtle.timingSafeEqual(
      computedSig as BufferSource,
      sigBytes as BufferSource,
    );
    if (!valid) return { ok: false };
    const value = uint8ToStr(valueBytes);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}
