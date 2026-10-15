// Worker-side copy of the `heuristic-v1` scorer (identical formula to
// apps/api/src/scoring.ts) used as the offline fallback when the TabPFN sidecar
// isn't reachable. Keeping it here (rather than importing across packages)
// avoids coupling the worker build to the API. EV/hr = P×bounty/est_hours×(0.5+0.5×match).
import type { FeatureRow } from "@paydirt/shared";

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

export function estimateHours(f: FeatureRow): number {
  if (f.hasGoodFirstIssueLabel) return clamp(2 + f.bodyLength / 4000, 1, 8);
  const base = 6 + f.bodyLength / 1500;
  const bountyNudge = clamp((f.bountyAmount ?? 0) / 100, 0, 8);
  return clamp(base + bountyNudge, 2, 80);
}

export function heuristicPSuccess(f: FeatureRow): { pSuccess: number; days: number } {
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
  const days = clamp(2 + respPenalty * 8 - 5 * f.maintainerMergeRatePrior90d, 1, 45);
  return { pSuccess: clamp(sigmoid(z), 0.02, 0.97), days };
}

export function evPerHour(f: FeatureRow, pSuccess: number, matchScore: number): number {
  const bounty = f.bountyAmount ?? 0;
  return (pSuccess * bounty * (0.5 + 0.5 * clamp(matchScore, 0, 1))) / estimateHours(f);
}
