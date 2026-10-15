// Temporal activities (PRD §8). These are the NON-deterministic side of the
// workflows — the only place that touches the network/DB. Every external call is
// gated so a machine without GitHub/DB/Ollama/Temporal still runs the pipeline
// end-to-end with visible, honest fallbacks.
import { Context } from "@temporalio/activity";
import { detectBounty, hasGoodFirstIssue, type FeatureRow } from "@paydirt/shared";
import { db } from "./db.js";
import type { DiscoveredIssue, UpsertResult } from "./types.js";
import { checkPr, repoStats, searchBounties } from "./clients/github.js";
import { draft, embed } from "./clients/ollama.js";
import { predict, train, type Prediction, type ScoredFeature } from "./clients/sidecar.js";

const DAY_MS = 86_400_000;

export function featuresFromIssue(i: DiscoveredIssue): FeatureRow {
  const ageDays = Math.max(0, Math.round((Date.now() - Date.parse(i.createdAt)) / DAY_MS));
  return {
    bountyAmount: i.bountyAmount,
    repoStars: i.repoStars,
    repoForks: i.repoForks,
    repoAgeDays: 730, // filled precisely by the collector (Phase 1); conservative default for live discovery
    language: i.language || "Unknown",
    issueAgeDaysAtSnapshot: ageDays,
    commentCountAtSnapshot: i.commentCount,
    claimantCountAtSnapshot: i.claimantCount,
    bodyLength: i.body.length,
    hasGoodFirstIssueLabel: hasGoodFirstIssue(i.labels),
    maintainerMedianFirstResponseHoursPrior90d: 24, // collector computes from maintainer_events hypertable
    maintainerMergeRatePrior90d: 0.5, // collector computes from prior merged/attempted
    repoCommitsPrior30d: 0,
    openIssueCount: i.openIssueCount,
  };
}

export async function searchGithubBounties(query?: string): Promise<DiscoveredIssue[]> {
  const log = Context.current().log;
  const { source, issues, rateRemaining } = await searchBounties(query);
  log.info("bounty search complete", { source, count: issues.length, rateRemaining });
  return issues;
}

export async function enrichRepoAndMaintainerStats(issues: DiscoveredIssue[]): Promise<DiscoveredIssue[]> {
  const out: DiscoveredIssue[] = [];
  for (const i of issues) {
    let enriched = i;
    if (!i.repoStars) {
      const s = await repoStats(i.repo);
      if (s) enriched = { ...i, repoStars: s.stars, repoForks: s.forks, language: i.language || s.language, openIssueCount: s.openIssues };
    }
    out.push(enriched);
  }
  return out;
}

/** Embed title+body via local Ollama (768-dim). Returns how many were embedded. */
export async function embedIssues(issues: DiscoveredIssue[]): Promise<number> {
  let n = 0;
  for (const i of issues) {
    const v = await embed(`${i.title}\n${i.body}`);
    if (v && v.length === 768) n++;
  }
  Context.current().log.info("embedIssues", { embedded: n, total: issues.length });
  return n;
}

export async function upsertIssues(issues: DiscoveredIssue[]): Promise<UpsertResult> {
  const pool = db();
  if (!pool) return { driver: "memory", received: issues.length, persisted: 0, ids: {} };

  const ids: Record<string, number> = {};
  let persisted = 0;
  for (const i of issues) {
    const ref = `${i.repo}#${i.number}`;
    const repo = await pool.query(
      `INSERT INTO repos (full_name, stars, forks, language, open_issues)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (full_name) DO UPDATE SET stars=EXCLUDED.stars, forks=EXCLUDED.forks,
         language=EXCLUDED.language, open_issues=EXCLUDED.open_issues, fetched_at=now()
       RETURNING id`,
      [i.repo, i.repoStars, i.repoForks, i.language || null, i.openIssueCount],
    );
    const repoId = Number(repo.rows[0]?.id);
    if (!Number.isFinite(repoId)) continue;
    const bounty = detectBounty(i.labels, i.title);
    const ins = await pool.query(
      `INSERT INTO issues (repo_id, number, title, body, url, state, labels, bounty_amount,
         bounty_currency, bounty_source, created_at, comment_count, claimant_count, body_length, has_good_first_issue)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'USD',$9,$10,$11,$12,$13,$14)
       ON CONFLICT (repo_id, number) DO UPDATE SET title=EXCLUDED.title, state=EXCLUDED.state,
         labels=EXCLUDED.labels, bounty_amount=EXCLUDED.bounty_amount, comment_count=EXCLUDED.comment_count
       RETURNING id`,
      [repoId, i.number, i.title, i.body, i.url, i.state, i.labels, bounty?.amount ?? i.bountyAmount,
        bounty?.source ?? i.bountySource, i.createdAt, i.commentCount, i.claimantCount, i.body.length,
        hasGoodFirstIssue(i.labels)],
    );
    const issueId = Number(ins.rows[0]?.id);
    if (Number.isFinite(issueId)) {
      ids[ref] = issueId;
      persisted++;
    }
  }
  return { driver: "postgres", received: issues.length, persisted, ids };
}

/** Score via the TabPFN sidecar; heuristic-v1 fallback keeps ranking visible. */
export async function scoreIssues(issues: DiscoveredIssue[]): Promise<Prediction[]> {
  const rows: ScoredFeature[] = issues.map((i) => ({ ref: `${i.repo}#${i.number}`, features: featuresFromIssue(i) }));
  return predict(rows);
}

export async function rankAndStore(
  issueIdRefs: Array<{ ref: string; issueId: number | null }>,
  predictions: Prediction[],
): Promise<UpsertResult> {
  const pool = db();
  if (!pool) return { driver: "memory", received: predictions.length, persisted: 0, ids: {} };
  const byRef = new Map(issueIdRefs.map((f) => [f.ref, f.issueId]));
  let persisted = 0;
  for (const p of predictions) {
    const issueId = byRef.get(p.ref);
    if (issueId == null) continue;
    const res = await pool.query(
      `INSERT INTO predictions (issue_id, model_version, p_success, days_to_merge_est, ev_per_hour)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (issue_id, model_version) DO UPDATE SET
         p_success=EXCLUDED.p_success, days_to_merge_est=EXCLUDED.days_to_merge_est, ev_per_hour=EXCLUDED.ev_per_hour,
         created_at=now() RETURNING id`,
      [issueId, p.modelVersion, p.pSuccess, p.daysToMergeEst, null],
    );
    if (res.rows[0]) persisted++;
  }
  return { driver: "postgres", received: predictions.length, persisted, ids: {} };
}

// ── Lifecycle helpers used by BountyLifecycleWorkflow ────────────────────────
export interface PollInput {
  repo: string;
  prNumber: number | null;
}

export async function checkPrStatus(input: PollInput): Promise<{ merged: boolean; reviewed: boolean } | null> {
  const s = await checkPr(input.repo, input.prNumber);
  return s ? { merged: s.merged, reviewed: s.reviewed } : null;
}

export interface DraftInput {
  title: string;
  body: string;
}

export async function draftFollowUp(input: DraftInput): Promise<string> {
  const text = await draft(
    `Write a short, friendly follow-up to a maintainer about this open-source bounty PR ` +
      `asking if there is anything needed to move it forward. Issue: ${input.title}\n${input.body.slice(0, 300)}`,
  );
  return text ?? `Hi — just checking if there's anything you need from me on "${input.title}". Happy to iterate.`;
}

// ── Retrain helpers used by RetrainWorkflow ──────────────────────────────────
export interface LabeledRow {
  ref: string;
  features: FeatureRow;
  success: 0 | 1;
  days_to_merge?: number;
  snapshot_time: string;
}

export async function buildTrainingRows(limit = 2000): Promise<LabeledRow[]> {
  const pool = db();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT i.url, i.labels, i.bounty_amount, i.linked_pr_merged, i.merged_at, i.created_at,
            i.comment_count, i.claimant_count, i.body_length, i.has_good_first_issue,
            r.full_name, r.stars, r.forks, r.language, r.open_issues
     FROM issues i JOIN repos r ON r.id = i.repo_id
     WHERE i.linked_pr_merged IS NOT NULL AND i.bounty_amount IS NOT NULL
     ORDER BY i.created_at DESC LIMIT $1`,
    [limit],
  );
  return (res.rows as Record<string, unknown>[]).map((r) => {
    const merged = r.linked_pr_merged === true;
    const created = r.created_at ? new Date(r.created_at as string).getTime() : Date.now();
    const mergedAt = r.merged_at ? new Date(r.merged_at as string).getTime() : null;
    const issue: DiscoveredIssue = {
      repo: String(r.full_name), number: 0, title: "", body: "", url: String(r.url), state: "closed",
      labels: (r.labels as string[]) ?? [], createdAt: new Date(created).toISOString(),
      commentCount: Number(r.comment_count ?? 0), claimantCount: Number(r.claimant_count ?? 0),
      bountyAmount: Number(r.bounty_amount ?? 0), bountySource: "github_label",
      repoStars: Number(r.stars ?? 0), repoForks: Number(r.forks ?? 0), language: String(r.language ?? ""),
      openIssueCount: Number(r.open_issues ?? 0),
    };
    const row: LabeledRow = {
      ref: issue.url, features: featuresFromIssue(issue), success: merged ? 1 : 0,
      snapshot_time: issue.createdAt,
    };
    if (mergedAt && merged) row.days_to_merge = Math.round((mergedAt - created) / DAY_MS);
    return row;
  });
}

export async function retrainModel(rows: LabeledRow[]): Promise<{ ok: boolean; error?: string; metrics?: Record<string, unknown> }> {
  const payload = rows.map((r) => ({ ...r.features, success: r.success, days_to_merge: r.days_to_merge, snapshot_at: r.snapshot_time }));
  return train(payload);
}
