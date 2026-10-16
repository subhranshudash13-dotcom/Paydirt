import type { FeatureRow } from "@paydirt/shared";
import { config } from "../config.js";

/**
 * Client for the TabPFN/logistic sidecar (`services/predictor`, PRD §7.4).
 * The sidecar already accepts camelCase TS FeatureRow keys (features.py `_get`),
 * so we forward the exact anonymous numeric features the collector builds — never
 * code, titles, or usernames. If the sidecar is offline/untrained we return null
 * and the store honestly falls back to the documented `heuristic-v1` baseline.
 */

export interface SidecarPrediction {
  pSuccess: number;
  daysToMergeEst: number | null;
  modelVersion: string;
}

export type Predictor = (
  rows: { ref: string; features: FeatureRow }[],
) => Promise<Map<string, SidecarPrediction> | null>;

async function fetchJsonWithTimeout(url: string, init: RequestInit, ms: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface PredictResponse {
  modelVersion?: string;
  predictions?: { ref?: string; pSuccess?: number; daysToMergeEst?: number | null }[];
}

/** Batched, sidecar-served p_success / days-to-merge. Null on any failure. */
export const predictRows: Predictor = async (rows) => {
  if (!rows.length) return new Map();
  try {
    const body = { rows: rows.map((r) => ({ ref: r.ref, ...r.features })) };
    const data = (await fetchJsonWithTimeout(
      `${config.predictorUrl}/predict`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      4000,
    )) as PredictResponse;

    const out = new Map<string, SidecarPrediction>();
    for (const p of data.predictions ?? []) {
      if (p.ref == null || typeof p.pSuccess !== "number") continue;
      out.set(String(p.ref), {
        pSuccess: p.pSuccess,
        daysToMergeEst: typeof p.daysToMergeEst === "number" ? p.daysToMergeEst : null,
        modelVersion: data.modelVersion ?? "sidecar",
      });
    }
    return out.size ? out : null;
  } catch {
    return null; // sidecar unreachable / untrained / timed out → heuristic fallback
  }
};

/** Cheap liveness probe used to label the model honestly in `/api/health`. */
export async function sidecarModelVersion(): Promise<string | null> {
  try {
    const data = (await fetchJsonWithTimeout(`${config.predictorUrl}/health`, { method: "GET" }, 2500)) as {
      modelTrained?: boolean;
      modelVersion?: string | null;
    };
    return data.modelTrained ? data.modelVersion ?? "sidecar" : null;
  } catch {
    return null;
  }
}
