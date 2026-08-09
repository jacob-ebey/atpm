import { readFile } from "node:fs/promises";

import { JetstreamSubscription } from "@atcute/jetstream";
import { is } from "@atcute/lexicons";

import { DevAtpmAlphaPackage as DevAtpmPackage } from "../src/lexicons/index.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const VERSION = 1;
const VERSION_CACHE = `.cache/cursor-v${VERSION}`;

if (!process.env.INDEXER_BASE_URL) {
  throw new Error("INDEXER_BASE_URL not set");
}
if (!process.env.INDEXER_SECRET) {
  throw new Error("INDEXER_SECRET not set");
}

const indexerBase = new URL(process.env.INDEXER_BASE_URL);

let cursor = await readFile(VERSION_CACHE, "utf8")
  .then((f) => Number.parseInt(f, 10))
  .catch(
    async () =>
      (await fetch(new URL("/registry/-/index", indexerBase)).then((r) => r.json())) as number,
  );

function exitHandler(options: { cleanup?: boolean; exit?: boolean }, _?: number) {
  if (options.cleanup) {
    mkdirSync(path.dirname(VERSION_CACHE), { recursive: true });
    writeFileSync(VERSION_CACHE, `${cursor}`);
  }
  if (options.exit) process.exit();
}

// do something when app is closing
process.on("exit", exitHandler.bind(null, { cleanup: true }));
// catches ctrl+c event
process.on("SIGINT", exitHandler.bind(null, { exit: true }));
// catches "kill pid" (for example: nodemon restart)
process.on("SIGUSR1", exitHandler.bind(null, { exit: true }));
process.on("SIGUSR2", exitHandler.bind(null, { exit: true }));

const resumeDate = new Date(cursor / 1000);
console.log(
  `Resuming from ${new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "long",
  }).format(resumeDate)}`,
);

const eventsToSync: {
  type: "create" | "update" | "delete";
  did: string;
  rkey: string;
  cursor: number;
}[] = [];
let syncing = false;
async function syncEvents() {
  if (syncing) return;
  syncing = true;
  while (eventsToSync.length > 0) {
    const event = eventsToSync.shift();
    if (!event) continue;
    const response = await fetch(new URL("/registry/-/index", indexerBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INDEXER_SECRET}`,
      },
      body: JSON.stringify(event),
    }).catch(() => undefined);
    const json = (await response?.json().catch(() => undefined)) as any;
    if (json?.success) {
      console.log("synced event", event);
    } else {
      console.error("failed to sync event", event, json?.error || "unknown error");
    }
  }
  syncing = false;
}

while (true) {
  const subscription = new JetstreamSubscription({
    url: "wss://jetstream2.us-east.bsky.network",
    wantedCollections: ["dev.atpm.alpha.package"],
    cursor,
  });

  for await (const event of subscription) {
    cursor = event.time_us;
    if (event.kind !== "commit" || event.commit.collection !== "dev.atpm.alpha.package") {
      continue;
    }

    if (!is(DevAtpmPackage.mainSchema, event.commit.record)) {
      continue;
    }

    eventsToSync.push({
      type: event.commit.operation,
      did: event.did,
      rkey: event.commit.rkey,
      cursor: event.time_us,
    });
    void syncEvents();
  }
}
