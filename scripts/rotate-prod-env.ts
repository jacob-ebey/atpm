import { execSync } from "node:child_process";

import { generateClientAssertionKey } from "@atcute/oauth-node-client";

// generateClientAssertionKey returns a JWK directly
const jwk = await generateClientAssertionKey("main", "ES256");
const jwkJson = JSON.stringify(jwk);

const sessionSecret = crypto.randomUUID() + "-" + crypto.randomUUID();
const indexerSecret = crypto.randomUUID() + "-" + crypto.randomUUID();

console.log(
  execSync(`vp exec wrangler secret put PRIVATE_KEY_JWK`, {
    encoding: "utf8",
    input: jwkJson,
  }),
);

console.log(
  execSync(`vp exec wrangler secret put SESSION_SECRET`, {
    encoding: "utf8",
    input: sessionSecret,
  }),
);

console.log(
  execSync(`vp exec wrangler secret put INDEXER_SECRET`, {
    encoding: "utf8",
    input: indexerSecret,
  }),
);

console.log("The following information will not be shown again:");
console.log(`  INDEXER_SECRET='${indexerSecret}'`);
