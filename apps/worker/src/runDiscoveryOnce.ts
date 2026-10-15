// Runs the DiscoveryWorkflow activity chain directly (no Temporal server needed)
// so the discover -> score -> rank pipeline is demoable right now against the
// live predictor sidecar. `npm run discovery:once -w @paydirt/worker`.
import { featuresFromIssue } from "./activities.js";
import { repoStats, searchBounties } from "./clients/github.js";
import { predict, sidecarHealth } from "./clients/sidecar.js";
import { evPerHour } from "./heuristics.js";

const NEUTRAL_MATCH = 0.5;

async function main(): Promise<void> {
  const health = await sidecarHealth();
  console.log(
    health.reachable
      ? `[discovery] predictor sidecar REACHABLE backend=${health.backend} model=${health.modelVersion} trained=${health.modelTrained}`
      : "[discovery] predictor sidecar DOWN -> heuristic-v1 fallback",
  );

  const { source, issues, rateRemaining } = await searchBounties();
  console.log(`[discovery] search source=${source} n=${issues.length} rateRemaining=${rateRemaining ?? "n/a"}`);

  const enriched = [];
  for (const i of issues) {
    if (i.repoStars) {
      enriched.push(i);
      continue;
    }
    const s = await repoStats(i.repo);
    enriched.push(s ? { ...i, repoStars: s.stars, repoForks: s.forks, language: i.language || s.language, openIssueCount: s.openIssues } : i);
  }

  const rows = enriched.map((i) => ({ ref: `${i.repo}#${i.number}`, features: featuresFromIssue(i) }));
  const predictions = await predict(rows);
  const featByRef = new Map(rows.map((r) => [r.ref, r.features]));

  const ranked = predictions
    .map((p) => ({
      ref: p.ref,
      pSuccess: p.pSuccess,
      days: p.daysToMergeEst,
      model: p.modelVersion,
      ev: evPerHour(featByRef.get(p.ref)!, p.pSuccess, NEUTRAL_MATCH),
      bounty: featByRef.get(p.ref)?.bountyAmount ?? 0,
    }))
    .sort((a, b) => b.ev - a.ev);

  console.log("\n  rank  EV/hr   $     P(succ)  days   model          ref");
  console.log("  ------------------------------------------------------------");
  ranked.forEach((r, i) => {
    console.log(
      `  ${String(i + 1).padStart(3)}  ${r.ev.toFixed(2).padStart(6)}  ${String(r.bounty).padStart(4)}  ` +
        `${(r.pSuccess * 100).toFixed(1).padStart(6)}%  ${String(r.days ?? "-").padStart(5)}  ${r.model.padEnd(14)}  ${r.ref}`,
    );
  });
  console.log(`\n[discovery] scored ${ranked.length} issues; top EV/hr = ${ranked[0]?.ev.toFixed(2)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
