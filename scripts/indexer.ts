import { JetstreamSubscription } from "@atcute/jetstream";
import { is } from "@atcute/lexicons";

import { DevAtpmAlphaPackage as DevAtpmPackage } from "../src/lexicons/index.ts";

if (!process.env.INDEXER_BASE_URL) {
  throw new Error("INDEXER_BASE_URL not set");
}
if (!process.env.INDEXER_SECRET) {
  throw new Error("INDEXER_SECRET not set");
}

const indexerBase = new URL(process.env.INDEXER_BASE_URL);

const cursor = (await fetch(new URL("/registry/-/index", indexerBase)).then((r) =>
  r.json(),
)) as number;

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

const subscription = new JetstreamSubscription({
  url: "wss://jetstream2.us-east.bsky.network",
  wantedCollections: ["dev.atpm.alpha.package"],
  cursor,
});

for await (const event of subscription) {
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
