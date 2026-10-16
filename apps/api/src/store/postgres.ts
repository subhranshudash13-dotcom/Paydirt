import pg from "pg";
import {
  type BoardQuery, type RankedIssue, type TrackedItem, type TrackSignal,
  type ModelMetrics, type Issue, type Repo, type Prediction,
} from "@paydirt/shared";
import type { MatchResolver } from "../profile.js";
import type { Store } from "./types.js";

const { Pool } = pg;

interface DbIssueRow {
  id: number; repo_id: number; number: number; title: string; body: string | null; url: string;
  state: string; labels: string[]; bounty_amount: string | null; bounty_currency: string | null;
  bounty_source: string | null; created_at: Date | null; closed_at: Date | null;
  comment_count: number; claimant_count: number; linked_pr_merged: boolean | null; merged_at: Date | null;
  has_good_first_issue: boolean;
  full_name: string; stars: number; forks: number; language: string | null; open_issues: number;
  model_version: string | null; p_success: number | null; days_to_merge_est: number | null;
  ev_per_hour: number | null; match_score: number | null; est_hours: number | null; features: unknown;
}

const num = (v: string | number | null | undefined): number | null =>
  v == null ? null : typeof v === "number" ? v : Number(v);

function mapRow(r: DbIssueRow): RankedIssue {
  const issue: Issue = {
    id: r.id, repoId: r.repo_id, number: r.number, title: r.title, body: r.body, url: r.url,
    state: r.state as "open" | "closed", labels: r.labels ?? [],
    bountyAmount: num(r.bounty_amount), bountyCurrency: r.bounty_currency,
    bountySource: (r.bounty_source as Issue["bountySource"]) ?? null,
    createdAt: r.created_at?.toISOString(), closedAt: r.closed_at?.toISOString(),
    commentCount: r.comment_count, claimantCount: r.claimant_count,
    linkedPrMerged: r.linked_pr_merged, mergedAt: r.merged_at?.toISOString(),
    hasGoodFirstIssue: r.has_good_first_issue,
  };
  const repo: Repo = { id: r.repo_id, fullName: r.full_name, stars: r.stars, forks: r.forks, language: r.language, openIssues: r.open_issues };
  const prediction: Prediction = {
    issueId: r.id, modelVersion: r.model_version ?? "heuristic-v1",
    pSuccess: r.p_success ?? 0, daysToMergeEst: r.days_to_merge_est, evPerHour: r.ev_per_hour,
    matchScore: r.match_score, estHours: r.est_hours, features: (r.features as Prediction["features"]) ?? undefined,
  };
  return { issue, repo, prediction };
}

const SELECT = `
  SELECT i.*, rl.full_name, rl.stars, rl.forks, rl.language, rl.open_issues,
         p.model_version, p.p_success, p.days_to_merge_est, p.ev_per_hour, p.match_score, p.est_hours, p.features
  FROM issues i
  JOIN repos rl ON rl.id = i.repo_id
  LEFT JOIN LATERAL (
    SELECT * FROM predictions pr WHERE pr.issue_id = i.id ORDER BY created_at DESC LIMIT 1
  ) p ON true`;

const SORT: Record<string, string> = {
  ev: "p.ev_per_hour DESC NULLS LAST",
  p: "p.p_success DESC NULLS LAST",
  bounty: "i.bounty_amount DESC NULLS LAST",
  match: "p.match_score DESC NULLS LAST",
  days: "p.days_to_merge_est ASC NULLS LAST",
};

export class PostgresStore implements Store {
  readonly driver = "postgres" as const;
  private matcher: MatchResolver | null = null;
  constructor(private readonly pool: pg.Pool) {}

  attachMatcher(m: MatchResolver | null): void {
    this.matcher = m;
    if (m) void this.recomputeMatch().catch(() => { /* best-effort; board still shows stored match */ });
  }

  /** Fold a real match_score into each row's prediction (and EV) in memory. */
  private applyMatch(rows: RankedIssue[]): RankedIssue[] {
    if (!this.matcher) return rows;
    return rows.map((r) => {
      const m = this.matcher!({ language: r.repo.language, title: r.issue.title, body: r.issue.body ?? "", labels: r.issue.labels });
      if (!m) return r;
      const matchScore = m.score;
      const p = r.prediction;
      const est = p.estHours ?? 0;
      const bounty = r.issue.bountyAmount ?? 0;
      const evPerHour = est > 0 ? (p.pSuccess * bounty * (0.5 + 0.5 * matchScore)) / est : p.evPerHour;
      return { ...r, prediction: { ...p, matchScore, evPerHour } };
    });
  }

  /** Persist recomputed match_score for current rows (best-effort). */
  private async recomputeMatch(): Promise<void> {
    const res = await this.pool.query(`${SELECT} LIMIT 200`);
    const mapped = this.applyMatch((res.rows as DbIssueRow[]).map(mapRow));
    for (const r of mapped) {
      await this.pool.query(
        `UPDATE predictions SET match_score = $2, ev_per_hour = $3
         WHERE id = (SELECT id FROM predictions WHERE issue_id = $1 ORDER BY created_at DESC LIMIT 1)`,
        [r.issue.id, r.prediction.matchScore, r.prediction.evPerHour],
      );
    }
  }

  async listBoard(q: BoardQuery): Promise<RankedIssue[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.language) { params.push(q.language); where.push(`lower(rl.language) = lower($${params.length})`); }
    if (q.minEv != null) { params.push(q.minEv); where.push(`p.ev_per_hour >= $${params.length}`); }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sort = SORT[q.sort ?? "ev"] ?? SORT.ev!;
    params.push(q.limit ?? 50);
    const res = await this.pool.query(`${SELECT} ${clause} ORDER BY ${sort} LIMIT $${params.length}`, params);
    return this.applyMatch((res.rows as DbIssueRow[]).map(mapRow));
  }

  async getIssue(id: number): Promise<RankedIssue | null> {
    const res = await this.pool.query(`${SELECT} WHERE i.id = $1 LIMIT 1`, [id]);
    const row = res.rows[0] as DbIssueRow | undefined;
    return row ? this.applyMatch([mapRow(row)])[0] ?? null : null;
  }

  async search(query: string, k: number): Promise<RankedIssue[]> {
    // Keyword side of hybrid_search; the embedding side is added once Ollama is up.
    const res = await this.pool.query(
      `${SELECT} WHERE i.tsv @@ websearch_to_tsquery('english', $1)
       ORDER BY ts_rank(i.tsv, websearch_to_tsquery('english', $1)) DESC LIMIT $2`,
      [query, k],
    );
    return this.applyMatch((res.rows as DbIssueRow[]).map(mapRow));
  }

  async listTracked(): Promise<TrackedItem[]> {
    const res = await this.pool.query(`SELECT * FROM tracked ORDER BY claimed_at DESC`);
    return (res.rows as { id: number; issue_id: number; workflow_id: string | null; status: string; claimed_at: Date; pr_url: string | null; payout_status: string | null; notes: string | null }[]).map((r) => ({
      id: r.id, issueId: r.issue_id, workflowId: r.workflow_id, status: r.status as TrackedItem["status"],
      claimedAt: r.claimed_at.toISOString(), prUrl: r.pr_url, payoutStatus: (r.payout_status as TrackedItem["payoutStatus"]) ?? "none", notes: r.notes,
    }));
  }

  async createTrack(issueId: number): Promise<TrackedItem | null> {
    const wf = `bounty-lifecycle-${issueId}`;
    const res = await this.pool.query(
      `INSERT INTO tracked (issue_id, workflow_id, status, payout_status)
       VALUES ($1, $2, 'CLAIMED', 'none')
       ON CONFLICT DO NOTHING
       RETURNING id, issue_id, workflow_id, status, claimed_at, pr_url, payout_status, notes`,
      [issueId, wf],
    );
    const r = res.rows[0] as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: Number(r.id), issueId: Number(r.issue_id), workflowId: String(r.workflow_id),
      status: String(r.status) as TrackedItem["status"], claimedAt: (r.claimed_at as Date).toISOString(),
      payoutStatus: (r.payout_status as TrackedItem["payoutStatus"]) ?? "none",
    };
  }

  async signalTrack(id: number, signal: TrackSignal): Promise<TrackedItem | null> {
    const map: Record<TrackSignal["type"], string> = {
      prOpened: "PR_OPEN", maintainerComment: "IN_REVIEW", markMerged: "MERGED", markPaid: "PAID", abandon: "ABANDONED",
    };
    const payout = signal.type === "markPaid" ? "paid" : signal.type === "markMerged" ? "pending" : null;
    const prUrl = signal.type === "prOpened" ? String(signal.payload?.url ?? "") : null;
    await this.pool.query(
      `UPDATE tracked SET status = $2, payout_status = COALESCE($3, payout_status), pr_url = COALESCE($4, pr_url) WHERE id = $1`,
      [id, map[signal.type], payout, prUrl],
    );
    const res = await this.pool.query(`SELECT * FROM tracked WHERE id = $1`, [id]);
    const r = res.rows[0] as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: Number(r.id), issueId: Number(r.issue_id), workflowId: String(r.workflow_id ?? ""),
      status: String(r.status) as TrackedItem["status"], claimedAt: (r.claimed_at as Date).toISOString(),
      payoutStatus: (String(r.payout_status ?? "none") as TrackedItem["payoutStatus"]),
    };
  }

  async getModelMetrics(): Promise<ModelMetrics> {
    const res = await this.pool.query(
      `SELECT count(*)::int AS rows,
              coalesce(avg((p_success >= 0.5)::int), 0)::float AS pos,
              coalesce(max(model_version), 'heuristic-v1') AS version
       FROM predictions`,
    );
    const r = res.rows[0] as { rows: number; pos: number; version: string };
    return {
      version: r.version, trainedAt: new Date().toISOString(), rows: r.rows, positiveRate: r.pos,
      classifier: { rocAuc: 0, prAuc: 0, calibrationEce: undefined },
      baselines: { bountyOnly: 0, logisticRegression: 0, gradientBoostedTrees: 0 },
      hoursSavedSim: { modelEvPerHour: 0, bountyOnlyEvPerHour: 0, deltaPct: 0 },
    };
  }
}
