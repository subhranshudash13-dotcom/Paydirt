import { MemoryStore } from "./memory.js";
import { PostgresStore } from "./postgres.js";
import { probeDb, type DbProbe } from "../db/index.js";
import type { FeedStatus } from "../live/hydrate.js";
import type { Store } from "./types.js";

export interface StoreHandle {
  store: Store;
  probe: DbProbe;
  feed?: FeedStatus; // set at startup / on /api/refresh; reflects the live board feed
}

/**
 * Choose the data driver. Postgres/Tiger Data is the real path; the in-memory store
 * (seeded with real bounty-label data) keeps the site visibly running when the DB is down.
 */
export async function createStore(): Promise<StoreHandle> {
  const probe = await probeDb();
  if (probe.connected && probe.pool) {
    return { store: new PostgresStore(probe.pool), probe };
  }
  console.warn(`[store] Postgres unavailable (${probe.reason ?? "n/a"}) → using memory driver (demo seed)`);
  return { store: new MemoryStore(), probe };
}

export type { Store } from "./types.js";
