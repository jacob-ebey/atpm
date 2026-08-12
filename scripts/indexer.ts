import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { JetstreamSubscription } from "@atcute/jetstream";

const VERSION = 1;
const VERSION_CACHE = `.cache/cursor-v${VERSION}`;

if (!process.env.INDEXER_BASE_URL) {
  throw new Error("INDEXER_BASE_URL not set");
}
if (!process.env.INDEXER_SECRET) {
  throw new Error("INDEXER_SECRET not set");
}

const indexerBase = new URL(process.env.INDEXER_BASE_URL);

const startCursor = await readFile(VERSION_CACHE, "utf8")
  .then((c) => {
    let num = Number.parseInt(c);
    if (!Number.isSafeInteger(num)) throw new Error();
    return num;
  })
  .catch(() =>
    fetch(new URL("/-/index", indexerBase))
      .then((r) => r.json())
      .then((data) => data as number),
  );

let liveCursor = Date.now() * 1000;
let backfillTasks = 0;

function exitHandler(options: { cleanup?: boolean; exit?: boolean }, _?: number) {
  if (options.cleanup) {
    if (backfillTasks === 0) {
      mkdirSync(path.dirname(VERSION_CACHE), { recursive: true });
      writeFileSync(VERSION_CACHE, `${liveCursor}`);
      console.log(`Cursor saved: ${liveCursor}`);
    } else {
      console.log("Backfill in progress – not saving cursor.");
    }
  }
  if (options.exit) process.exit();
}

process.on("exit", exitHandler.bind(null, { cleanup: true }));
process.on("SIGINT", exitHandler.bind(null, { exit: true }));
process.on("SIGUSR1", exitHandler.bind(null, { exit: true }));
process.on("SIGUSR2", exitHandler.bind(null, { exit: true }));

const eventsToSync: {
  type: "create" | "update" | "delete";
  collection: "dev.atpm.alpha.package" | "dev.atpm.alpha.stage";
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
    const response = await fetch(new URL("/-/index", indexerBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INDEXER_SECRET}`,
      },
      body: JSON.stringify(event),
    }).catch(() => undefined);
    const json = (await response?.json().catch(() => undefined)) as any;
    if (json?.success) {
      console.log("🌀 Synced", event);
    } else {
      console.error("failed to sync event", event, json?.error || "unknown error");
    }
  }
  syncing = false;
}

async function processSegment(start: number, end: number): Promise<void> {
  backfillTasks++;
  console.log(
    `⏳ Backfilling segment: ${new Date(start / 1000).toISOString()} → ${new Date(end / 1000).toISOString()}`,
  );
  const subscription = new JetstreamSubscription({
    url: "wss://jetstream2.us-east.bsky.network",
    wantedCollections: ["dev.atpm.alpha.package", "dev.atpm.alpha.stage"],
    cursor: start,
  });

  for await (const event of subscription) {
    if (event.time_us >= end) break; // stop at segment end

    if (
      event.kind !== "commit" ||
      (event.commit.collection !== "dev.atpm.alpha.package" &&
        event.commit.collection !== "dev.atpm.alpha.stage")
    ) {
      continue;
    }

    eventsToSync.push({
      type: event.commit.operation,
      collection: event.commit.collection,
      did: event.did,
      rkey: event.commit.rkey,
      cursor: event.time_us,
    });
    void syncEvents();
  }

  backfillTasks--;
  console.log(`✅ ${new Date(start / 1000).toISOString()} → ${new Date(end / 1000).toISOString()}`);
  if (backfillTasks === 0) {
    console.log(`✅ Backfill Done`);
  } else {
    console.log("⏳", backfillTasks, "remaining");
  }
}

const nowPromise = Promise.withResolvers<number>();

void (async () => {
  console.log(`Live subscription starting from ${new Date(liveCursor / 1000).toISOString()}`);
  const subscription = new JetstreamSubscription({
    url: "wss://jetstream2.us-east.bsky.network",
    wantedCollections: ["dev.atpm.alpha.package", "dev.atpm.alpha.stage"],
  });

  nowPromise.resolve(subscription.cursor);

  for await (const event of subscription) {
    liveCursor = event.time_us;
    liveCursor = event.time_us;

    if (
      event.kind !== "commit" ||
      (event.commit.collection !== "dev.atpm.alpha.package" &&
        event.commit.collection !== "dev.atpm.alpha.stage")
    ) {
      continue;
    }

    eventsToSync.push({
      type: event.commit.operation,
      collection: event.commit.collection,
      did: event.did,
      rkey: event.commit.rkey,
      cursor: event.time_us,
    });
    void syncEvents();
  }
})();

const now = await nowPromise.promise;
const diff = now - startCursor;
const TEN_MINUTES_US = 10 * 60 * 1_000_000;

if (diff > TEN_MINUTES_US) {
  const segmentSize = Math.floor(diff / 4);
  const segments = [];
  for (let i = 0; i < 4; i++) {
    const start = startCursor + i * segmentSize;
    const end = i === 3 ? now : startCursor + (i + 1) * segmentSize;
    segments.push({ start, end });
  }
  console.log(
    `Backfilling ${(diff / 1_000_000 / 60).toFixed(2)} minutes in 4 parallel segments...`,
  );
  void segments.map(({ start, end }) => processSegment(start, end));
} else {
  console.log(`Backfilling ${(diff / 1_000_000 / 60).toFixed(2)} minutes in a single segment...`);
  void processSegment(startCursor, now);
}
