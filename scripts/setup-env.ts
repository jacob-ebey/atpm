import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { generateClientAssertionKey } from "@atcute/oauth-node-client";

const ensureEnvLocal = async () => {
  const envLocalPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envLocalPath)) {
    await writeFile(envLocalPath, "");
  }

  return envLocalPath;
};

const upsertEnvVar = (input: string, key: string, value: string) => {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");

  if (re.test(input)) {
    const match = input.match(re);
    const current = match ? match[0].slice(key.length + 1) : "";
    const trimmed = current.trim();

    if (trimmed === "" || trimmed === `''` || trimmed === `""`) {
      return input.replace(re, line);
    }

    return input;
  }

  const suffix = input.endsWith("\n") || input.length === 0 ? "" : "\n";
  return `${input}${suffix}${line}\n`;
};

const envLocalPath = await ensureEnvLocal();
const envLocal = await readFile(envLocalPath, "utf8");

// generateClientAssertionKey returns a JWK directly
const jwk = await generateClientAssertionKey("main", "ES256");
const jwkJson = JSON.stringify(jwk);
let updated = upsertEnvVar(envLocal, "INDEXER_BASE_URL", `'http://127.0.0.1:5173/'`);
updated = upsertEnvVar(updated, "INDEXER_SECRET", `'${crypto.randomUUID()}'`);
updated = upsertEnvVar(updated, "PRIVATE_KEY_JWK", `'${jwkJson}'`);
updated = upsertEnvVar(updated, "SESSION_SECRET", `'${crypto.randomUUID()}'`);

if (updated !== envLocal) {
  await writeFile(envLocalPath, updated);
  console.log(`updated ${envLocalPath}`);
} else {
  console.log(`no changes to ${envLocalPath}`);
}
