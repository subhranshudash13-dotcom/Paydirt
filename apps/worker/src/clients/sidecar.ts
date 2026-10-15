// HTTP client for the Python predictor sidecar (PRD §7.4). Sends only anonymous
// numeric feature rows (data boundary: no code/usernames). Falls back to the
// heuristic scorer whenever the sidecar is down or untrained, so discovery keeps
// ranking with a visible, honest model_version.
import type { FeatureRow } from "@paydirt/shared";
import { config } from "../config.js";
import { heuristicPSuccess } from "../heuristics.js";

export interface ScoredFeature {
  ref: string;
  features: FeatureRow;
}

export interface Prediction {
  ref: string;
  pSuccess: number;
  daysToMergeEst: number | null;
  modelVersion: string;
}

interface SidecarPrediction {
  ref: string;
  pSuccess: number;
  daysToMergeEst: number | null;
  modelVersion: string;
}

function fallback(r: ScoredFeature): Prediction {
  const h = heuristicPSuccess(r.features);
  return { ref: r.ref, pSuccess: h.pSuccess, daysToMergeEst: h.days, modelVersion: "heuristic-v1" };
}

export async function predict(rows: ScoredFeature[]): Promise<Prediction[]> {
  if (rows.length === 0) return [];
  try {
    const body = { rows: rows.map((r) => ({ ref: r.ref, ...r.features })) };
    const res = await fetch(`${config.predictorUrl}/predict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`sidecar ${res.status}`);
    const data = (await res.json()) as { predictions: SidecarPrediction[] };
    const byRef = new Map(data.predictions.map((p) => [String(p.ref), p]));
    return rows.map((r) => {
      const p = byRef.get(r.ref);
      return p
        ? { ref: r.ref, pSuccess: p.pSuccess, daysToMergeEst: p.daysToMergeEst ?? null, modelVersion: p.modelVersion }
        : fallback(r);
    });
  } catch {
    return rows.map(fallback);
  }
}

export interface SidecarHealth {
  reachable: boolean;
  backend: string;
  modelVersion: string;
  modelTrained: boolean;
}

/** GET /health — reports the ACTUAL serving backend (never assumes TabPFN). */
export async function sidecarHealth(): Promise<SidecarHealth> {
  try {
    const res = await fetch(`${config.predictorUrl}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { reachable: false, backend: "unreachable", modelVersion: "n/a", modelTrained: false };
    const d = (await res.json()) as { backend?: string; modelVersion?: string; modelTrained?: boolean };
    return {
      reachable: true,
      backend: d.backend ?? "unknown",
      modelVersion: d.modelVersion ?? "n/a",
      modelTrained: d.modelTrained ?? false,
    };
  } catch {
    return { reachable: false, backend: "unreachable", modelVersion: "n/a", modelTrained: false };
  }
}

export interface TrainResult {
  ok: boolean;
  metrics?: Record<string, unknown>;
  error?: string;
}

/** POST /train (PRD §7.4) — called by RetrainWorkflow. Anonymous rows only. */
export async function train(rows: Array<Record<string, unknown>>): Promise<TrainResult> {
  try {
    const res = await fetch(`${config.predictorUrl}/train`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return { ok: false, error: `sidecar train ${res.status}` };
    return { ok: true, metrics: (await res.json()) as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
