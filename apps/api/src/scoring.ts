import type { FeatureRow } from "@paydirt/shared";

/**
 * Transparent scoring model — `heuristic-v1`.
 * This is a documented, leakage-free baseline the UI falls back on when the TabPFN
 * sidecar is not reachable. Once the sidecar serves a model, `/api/model` reports the
 * real TabPFN metrics and predictions; the EV formula below stays identical.
 *
 *   EV/hr = P(success) × bounty ÷ est_hours × (0.5 + 0.5 × match)
 */

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

export interface ScoreInput extends FeatureRow {
  matchScore: number;
}

export interface ScoreOutput {
  pSuccess: number;
  daysToMergeEst: number;
  estHours: number;
  evPerHour: number;
}

export function estimateHours(f: FeatureRow): number {
  // Rough effort proxy: good-first-issues are cheap, big bounties imply more work.
  if (f.hasGoodFirstIssueLabel) return clamp(2 + f.bodyLength / 4000, 1, 8);
  const base = 6 + f.bodyLength / 1500;
  const bountyNudge = clamp((f.bountyAmount ?? 0) / 100, 0, 8);
  return clamp(base + bountyNudge, 2, 80);
}

export function score(f: ScoreInput): ScoreOutput {
  const respPenalty = clamp(f.maintainerMedianFirstResponseHoursPrior90d / 72, 0, 3);
  const z =
    -1.1 +
    2.2 * clamp(f.maintainerMergeRatePrior90d, 0, 1) -
    0.9 * respPenalty +
    0.35 * Math.log1p(f.repoStars) * 0.1 +
    0.5 * clamp((f.bountyAmount ?? 0) / 500, 0, 1) -
    0.15 * clamp(f.claimantCountAtSnapshot / 5, 0, 1) +
    0.25 * (f.hasGoodFirstIssueLabel ? 1 : 0) -
    0.1 * clamp(f.issueAgeDaysAtSnapshot / 30, 0, 2);
  const pSuccess = clamp(sigmoid(z), 0.02, 0.97);

  const estHours = estimateHours(f);
  const bounty = f.bountyAmount ?? 0;
  const daysToMergeEst = clamp(2 + respPenalty * 8 - 5 * f.maintainerMergeRatePrior90d, 1, 45);
  const evPerHour = (pSuccess * bounty * (0.5 + 0.5 * clamp(f.matchScore, 0, 1))) / estHours;

  return { pSuccess, daysToMergeEst, estHours, evPerHour };
}

/** Baselines for the Model tab comparison (PRD §7.3). */
export function rankBountyOnly(rows: ScoreInput[]): number[] {
  return rows.map((r) => r.bountyAmount ?? 0);
}
