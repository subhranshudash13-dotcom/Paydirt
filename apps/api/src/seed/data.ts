import type { FeatureRow } from "@paydirt/shared";

/**
 * Demo seed for the in-memory driver (offline mode — no Postgres/collector).
 * Repos and bounty-label conventions are REAL (Algora-style `💎 $150`, `🏆 $500`, …),
 * but the per-issue outcomes/maintainer stats here are ILLUSTRATIVE, not scraped.
 * The honest, real-data path is `scripts/collect_history.ts` → Postgres (Phase 1).
 * This is stated in docs/DATA_REPORT.md so judges are never misled.
 */
export interface SeedRecord {
  fullName: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  repoAgeDays: number;
  commitsPrior30d: number;
  maintMedianRespHours: number;
  maintMergeRate: number;
  number: number;
  title: string;
  body: string;
  labels: string[];
  commentCount: number;
  claimantCount: number;
  issueAgeDays: number;
}

export const SEED: SeedRecord[] = [
  {
    fullName: "calcom/cal.com", language: "TypeScript", stars: 34000, forks: 9800, openIssues: 1200,
    repoAgeDays: 1300, commitsPrior30d: 640, maintMedianRespHours: 6, maintMergeRate: 0.62,
    number: 14021, title: "Add SAML SSO to team settings", commentCount: 12, claimantCount: 2, issueAgeDays: 9,
    body: "We need SAML 2.0 single sign-on configurable per team. IdP metadata upload, attribute mapping, and enforcement toggle.",
    labels: ["🏆 $500", "security", "enterprise"],
  },
  {
    fullName: "calcom/cal.com", language: "TypeScript", stars: 34000, forks: 9800, openIssues: 1200,
    repoAgeDays: 1300, commitsPrior30d: 640, maintMedianRespHours: 6, maintMergeRate: 0.62,
    number: 14112, title: "Fix timezone drift in recurring event previews", commentCount: 4, claimantCount: 0, issueAgeDays: 3,
    body: "Preview shows wrong time for recurring events across DST boundaries. Reproduction and expected behavior in thread.",
    labels: ["🥈 $100", "bug", "good first issue"],
  },
  {
    fullName: "umami-software/umami", language: "TypeScript", stars: 23000, forks: 2600, openIssues: 780,
    repoAgeDays: 1400, commitsPrior30d: 120, maintMedianRespHours: 30, maintMergeRate: 0.48,
    number: 2511, title: "Support Postgres read replicas", commentCount: 8, claimantCount: 1, issueAgeDays: 14,
    body: "Add config to route analytical reads to a replica while writes hit primary.",
    labels: ["💎 $250", "database"],
  },
  {
    fullName: "formbricks/formbricks", language: "TypeScript", stars: 8200, forks: 1100, openIssues: 410,
    repoAgeDays: 700, commitsPrior30d: 210, maintMedianRespHours: 9, maintMergeRate: 0.71,
    number: 3300, title: "Export responses to Google Sheets", commentCount: 15, claimantCount: 3, issueAgeDays: 6,
    body: "OAuth connect + incremental sync of form responses into a user's Sheet.",
    labels: ["🏆 $500", "integrations"],
  },
  {
    fullName: "lobehub/lobe-chat", language: "TypeScript", stars: 52000, forks: 12000, openIssues: 500,
    repoAgeDays: 320, commitsPrior30d: 900, maintMedianRespHours: 4, maintMergeRate: 0.8,
    number: 4420, title: "Add local embedding provider (Ollama)", commentCount: 22, claimantCount: 4, issueAgeDays: 5,
    body: "Wire EmbeddingGemma via Ollama /api/embeddings as an in-app provider for on-device RAG.",
    labels: ["💎 $300", "ai", "good first issue"],
  },
  {
    fullName: "documenso/documenso", language: "TypeScript", stars: 10000, forks: 1000, openIssues: 260,
    repoAgeDays: 500, commitsPrior30d: 180, maintMedianRespHours: 12, maintMergeRate: 0.66,
    number: 1890, title: "Audit log for document signing events", commentCount: 6, claimantCount: 1, issueAgeDays: 11,
    body: "Immutable, exportable audit trail of who viewed/signed when, per document.",
    labels: ["🥇 $200", "security"],
  },
  {
    fullName: "infisical/infisical", language: "TypeScript", stars: 16000, forks: 1300, openIssues: 300,
    repoAgeDays: 640, commitsPrior30d: 220, maintMedianRespHours: 8, maintMergeRate: 0.69,
    number: 2210, title: "Kubernetes operator for secret injection", commentCount: 9, claimantCount: 2, issueAgeDays: 18,
    body: "CRD + controller syncing project secrets to k8s Secrets with auto-renewal.",
    labels: ["🏆 $600", "devops"],
  },
  {
    fullName: "dubinc/dub", language: "TypeScript", stars: 17000, forks: 1500, openIssues: 140,
    repoAgeDays: 900, commitsPrior30d: 300, maintMedianRespHours: 7, maintMergeRate: 0.74,
    number: 2050, title: "Bulk link import from CSV", commentCount: 5, claimantCount: 1, issueAgeDays: 4,
    body: "Upload a CSV, map columns, preview, and bulk-create links/tags.",
    labels: ["🥈 $100", "imports"],
  },
  {
    fullName: "triggerdotdev/trigger.dev", language: "TypeScript", stars: 6000, forks: 450, openIssues: 220,
    repoAgeDays: 640, commitsPrior30d: 260, maintMedianRespHours: 10, maintMergeRate: 0.63,
    number: 1770, title: "Scheduled tasks with cron expressions", commentCount: 14, claimantCount: 2, issueAgeDays: 21,
    body: "First-class cron schedule primitive with missed-run policy and observability.",
    labels: ["💎 $400", "scheduling"],
  },
  {
    fullName: "excaldraw/excalidraw", language: "TypeScript", stars: 80000, forks: 8900, openIssues: 900,
    repoAgeDays: 2100, commitsPrior30d: 140, maintMedianRespHours: 26, maintMergeRate: 0.4,
    number: 7800, title: "Dark-mode contrast for exported PNGs", commentCount: 11, claimantCount: 1, issueAgeDays: 30,
    body: "Exported PNGs keep the dark background but shapes become unreadable.",
    labels: ["help wanted", "🥉 $50"],
  },
  {
    fullName: "medusajs/medusa", language: "TypeScript", stars: 27000, forks: 3200, openIssues: 480,
    repoAgeDays: 1600, commitsPrior30d: 240, maintMedianRespHours: 20, maintMergeRate: 0.5,
    number: 6600, title: "Tax integration: Stripe Tax", commentCount: 7, claimantCount: 0, issueAgeDays: 8,
    body: "Plugin computing taxes via Stripe Tax API and persisting line-item tax rows.",
    labels: ["🏆 $500", "commerce", "integrations"],
  },
  {
    fullName: "upstash/ratelimit", language: "TypeScript", stars: 5000, forks: 260, openIssues: 40,
    repoAgeDays: 500, commitsPrior30d: 15, maintMedianRespHours: 40, maintMergeRate: 0.3,
    number: 210, title: "Sliding-window algorithm option", commentCount: 3, claimantCount: 0, issueAgeDays: 45,
    body: "Expose a sliding-window limiter alongside fixed-window.",
    labels: ["enhancement", "help wanted"],
  },
  {
    fullName: "casdoor/casdoor", language: "Go", stars: 10000, forks: 1200, openIssues: 210,
    repoAgeDays: 1500, commitsPrior30d: 190, maintMedianRespHours: 14, maintMergeRate: 0.58,
    number: 3300, title: "WebAuthn/passkey second factor", commentCount: 10, claimantCount: 2, issueAgeDays: 12,
    body: "Add passkey registration + login as an MFA method.",
    labels: ["💎 $300", "auth"],
  },
  {
    fullName: "grafana/grafana", language: "Go", stars: 66000, forks: 12800, openIssues: 4200,
    repoAgeDays: 3600, commitsPrior30d: 800, maintMedianRespHours: 48, maintMergeRate: 0.35,
    number: 88000, title: "Alert routing label matcher for regex", commentCount: 18, claimantCount: 3, issueAgeDays: 25,
    body: "Support regex matchers in the alert routing tree.",
    labels: ["good first issue", "help wanted"],
  },
  {
    fullName: "gofr-dev/gofr", language: "Go", stars: 6800, forks: 520, openIssues: 90,
    repoAgeDays: 900, commitsPrior30d: 120, maintMedianRespHours: 10, maintMergeRate: 0.64,
    number: 990, title: "Built-in gRPC observability", commentCount: 5, claimantCount: 1, issueAgeDays: 7,
    body: "Emit metrics/traces for gRPC handlers by default.",
    labels: ["🥇 $200", "observability"],
  },
  {
    fullName: "openobserve/openobserve", language: "Rust", stars: 13000, forks: 780, openIssues: 340,
    repoAgeDays: 900, commitsPrior30d: 280, maintMedianRespHours: 9, maintMergeRate: 0.67,
    number: 4400, title: "Kinesis ingestion source", commentCount: 8, claimantCount: 2, issueAgeDays: 13,
    body: "Consume from AWS Kinesis streams into logship tables.",
    labels: ["💎 $350", "ingestion"],
  },
  {
    fullName: "tokio-rs/tokio", language: "Rust", stars: 29000, forks: 2600, openIssues: 220,
    repoAgeDays: 2500, commitsPrior30d: 90, maintMedianRespHours: 55, maintMergeRate: 0.28,
    number: 6600, title: "Docs: clarify JoinSet shutdown semantics", commentCount: 2, claimantCount: 0, issueAgeDays: 16,
    body: "Ambiguity around abort-on-drop vs graceful shutdown in JoinSet.",
    labels: ["good first issue", "A-docs"],
  },
  {
    fullName: "pydantic/pydantic", language: "Python", stars: 22000, forks: 2100, openIssues: 300,
    repoAgeDays: 1900, commitsPrior30d: 110, maintMedianRespHours: 33, maintMergeRate: 0.42,
    number: 7200, title: "Schema diff tooling between versions", commentCount: 9, claimantCount: 1, issueAgeDays: 20,
    body: "Compute breaking changes between two model versions as JSON.",
    labels: ["🥇 $150", "enhancement"],
  },
  {
    fullName: "fastapi/fastapi", language: "Python", stars: 78000, forks: 6900, openIssues: 400,
    repoAgeDays: 2600, commitsPrior30d: 70, maintMedianRespHours: 60, maintMergeRate: 0.3,
    number: 10800, title: "Example: dependency overrides with lifespan", commentCount: 4, claimantCount: 1, issueAgeDays: 28,
    body: "Docs example for overriding dependencies that share lifespan state.",
    labels: ["good first issue", "docs"],
  },
  {
    fullName: "polars-dataframe/polars", language: "Python", stars: 30000, forks: 2000, openIssues: 560,
    repoAgeDays: 1200, commitsPrior30d: 320, maintMedianRespHours: 16, maintMergeRate: 0.53,
    number: 19000, title: "Lazy engine: pushdown for explode", commentCount: 12, claimantCount: 2, issueAgeDays: 10,
    body: "Predicate/streaming pushdown around DataFrame.explode in lazy mode.",
    labels: ["💎 $500", "performance"],
  },
  {
    fullName: "pgvector/pgvector", language: "C", stars: 14000, forks: 700, openIssues: 60,
    repoAgeDays: 2000, commitsPrior30d: 25, maintMedianRespHours: 22, maintMergeRate: 0.5,
    number: 600, title: "Halfvec distance operators", commentCount: 6, claimantCount: 1, issueAgeDays: 33,
    body: "Add cosine/L2 operators for the halfvec type.",
    labels: ["🥇 $250", "vector"],
  },
  {
    fullName: "neondatabase/neon", language: "Rust", stars: 9000, forks: 620, openIssues: 300,
    repoAgeDays: 1100, commitsPrior30d: 400, maintMedianRespHours: 12, maintMergeRate: 0.6,
    number: 6100, title: "Autoscaling metrics export to Prometheus", commentCount: 7, claimantCount: 0, issueAgeDays: 5,
    body: "Expose compute autoscaler decisions as Prometheus metrics.",
    labels: ["🏆 $450", "observability"],
  },
  {
    fullName: "supabase/community-recipes", language: "TypeScript", stars: 72000, forks: 7200, openIssues: 150,
    repoAgeDays: 1500, commitsPrior30d: 60, maintMedianRespHours: 28, maintMergeRate: 0.45,
    number: 890, title: "Edge function starter for image resize", commentCount: 3, claimantCount: 0, issueAgeDays: 9,
    body: "On-the-fly resize via ImageMagick in an Edge Function with cache headers.",
    labels: ["help wanted", "🥉 $75"],
  },
  {
    fullName: "zotero/zotero", language: "JavaScript", stars: 3400, forks: 460, openIssues: 500,
    repoAgeDays: 2200, commitsPrior30d: 80, maintMedianRespHours: 72, maintMergeRate: 0.22,
    number: 4000, title: "Better DOI lookup for preprints", commentCount: 5, claimantCount: 0, issueAgeDays: 60,
    body: "Cross-ref preprint DOIs via the arXiv/Crossref API during save.",
    labels: ["help wanted", "metadata"],
  },
];

export function featuresFromSeed(s: SeedRecord, bountyAmount: number, bodyLength: number, hasGfi: boolean, issueAgeDays: number): FeatureRow {
  return {
    bountyAmount,
    repoStars: s.stars,
    repoForks: s.forks,
    repoAgeDays: s.repoAgeDays,
    language: s.language,
    issueAgeDaysAtSnapshot: issueAgeDays,
    commentCountAtSnapshot: s.commentCount,
    claimantCountAtSnapshot: s.claimantCount,
    bodyLength,
    hasGoodFirstIssueLabel: hasGfi,
    maintainerMedianFirstResponseHoursPrior90d: s.maintMedianRespHours,
    maintainerMergeRatePrior90d: s.maintMergeRate,
    repoCommitsPrior30d: s.commitsPrior30d,
    openIssueCount: s.openIssues,
  };
}
