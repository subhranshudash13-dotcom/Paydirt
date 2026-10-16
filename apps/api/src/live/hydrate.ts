import type { Store } from "../store/types.js";
import { MemoryStore } from "../store/memory.js";
import { fetchLiveSeed } from "./github.js";
import { predictRows } from "./predictor.js";
export interface FeedStatus {
  source: "live-github" | "seed" | "postgres";
  modelVersion: string;
  count: number;
}

/**
 * Make the board dynamic instead of hardcoded:
 *   1. attach the local TabPFN/logistic sidecar so predictions are model-served;
 *   2. try to reseed the board with REAL GitHub bounty issues (one search call).
 *
 * Every external dependency degrades honestly: no sidecar → heuristic; GitHub
 * rate-limited/offline → the demo seed. The Postgres path is already the real,
 * populated feed, so we only attach the predictor there.
 */
export async function hydrate(store: Store): Promise<FeedStatus> {
  if (store instanceof MemoryStore) {
    store.attachPredictor(predictRows);
    const rec = await fetchLiveSeed();
    if (rec && rec.length) store.reloadSeed(rec, "live-github");
    await store.getModelMetrics(); // warm the predictor cache + resolve the real modelVersion
    return { source: store.dataSource, modelVersion: store.modelVersion, count: store.rowCount };
  }

  // Postgres/Tiger Data is the real, populated feed — predictions come from the
  // stored model rows, so no reseeding/attaching is required here.
  const rows = await store.listBoard({ sort: "ev", limit: 200 });
  return { source: "postgres", modelVersion: rows[0]?.prediction.modelVersion ?? "model-served", count: rows.length };
}
