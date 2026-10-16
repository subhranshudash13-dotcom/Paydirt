import {
  detectBounty,
  hasGoodFirstIssue,
  type BoardQuery,
  type RankedIssue,
  type TrackedItem,
  type TrackSignal,
  type ModelMetrics,
  type TrackStatus,
  type Issue,
  type Repo,
  type FeatureRow,
} from "@paydirt/shared";
import { score } from "../scoring.js";
import { featuresFromSeed, SEED, type SeedRecord } from "../seed/data.js";
import type { MatchResolver } from "../profile.js";
import type { Store } from "./types.js";

const MODEL_VERSION = "heuristic-v1";
const NEUTRAL_MATCH = 0.5; // used until a profile is ingested (Loop 7)

interface Row {
  issue: Issue;
  repo: Repo;
  features: FeatureRow;
}

function buildRow(s: SeedRecord, id: number, repoId: number): Row {
  const bounty = detectBounty(s.labels, s.title);
  const bodyLength = s.body.length;
  const gfi = hasGoodFirstIssue(s.labels);
  const amount = bounty?.amount ?? 0;
  const features = featuresFromSeed(s, amount, bodyLength, gfi, s.issueAgeDays);
  const issue: Issue = {
    id,
    repoId,
    number: s.number,
    title: s.title,
    body: s.body,
    url: `https://github.com/${s.fullName}/issues/${s.number}`,
    state: "open",
    labels: s.labels,
    bountyAmount: amount || null,
    bountyCurrency: bounty?.currency ?? null,
    bountySource: bounty?.source ?? null,
    createdAt: new Date(Date.now() - s.issueAgeDays * 86400_000).toISOString(),
    commentCount: s.commentCount,
    claimantCount: s.claimantCount,
    hasGoodFirstIssue: gfi,
  };
  const repo: Repo = {
    id: repoId,
    fullName: s.fullName,
    stars: s.stars,
    forks: s.forks,
    language: s.language,
    openIssues: s.openIssues,
  };
  return { issue, repo, features };
}

const round = (x: number, p: number): number => Math.round(x * 10 ** p) / 10 ** p;

export class MemoryStore implements Store {
  readonly driver = "memory" as const;
  private baseRows: Row[];
  private tracked: TrackedItem[] = [];
  private trackedSeq = 1;
  private matcher: MatchResolver | null = null;

  constructor() {
    const repoIds = new Map<string, number>();
    const rid = (fn: string): number => {
      let v = repoIds.get(fn);
      if (!v) {
        v = repoIds.size + 1;
        repoIds.set(fn, v);
      }
      return v;
    };
    this.baseRows = SEED.map((s, i) => buildRow(s, i + 1, rid(s.fullName)));
  }

  attachMatcher(m: MatchResolver | null): void {
    this.matcher = m;
  }

  /** Compute a ranked row, folding the real match_score into EV via scoring. */
  private rankedOf(row: Row): RankedIssue {
    const m = this.matcher?.({
      language: row.repo.language,
      title: row.issue.title,
      body: row.issue.body ?? "",
      labels: row.issue.labels,
    });
    const matchScore = m?.score ?? NEUTRAL_MATCH;
    const out = score({ ...row.features, matchScore });
    return {
      issue: row.issue,
      repo: row.repo,
      prediction: {
        issueId: row.issue.id,
        modelVersion: MODEL_VERSION,
        pSuccess: round(out.pSuccess, 4),
        daysToMergeEst: round(out.daysToMergeEst, 2),
        evPerHour: round(out.evPerHour, 4),
        matchScore: round(matchScore, 4),
        estHours: round(out.estHours, 2),
        features: row.features,
      },
    };
  }

  private allRanked(): RankedIssue[] {
    return this.baseRows.map((r) => this.rankedOf(r));
  }

  private byId(id: number): RankedIssue | undefined {
    const base = this.baseRows.find((r) => r.issue.id === id);
    return base ? this.rankedOf(base) : undefined;
  }

  async listBoard(q: BoardQuery): Promise<RankedIssue[]> {
    let rows = this.allRanked();
    if (q.language) rows = rows.filter((r) => r.repo.language?.toLowerCase() === q.language?.toLowerCase());
    if (q.minEv != null) rows = rows.filter((r) => (r.prediction.evPerHour ?? 0) >= q.minEv!);
    const key = q.sort ?? "ev";
    rows.sort((a, b) => {
      const P = (x: RankedIssue): number => {
        switch (key) {
          case "ev": return x.prediction.evPerHour ?? 0;
          case "p": return x.prediction.pSuccess;
          case "bounty": return x.issue.bountyAmount ?? 0;
          case "match": return x.prediction.matchScore ?? 0;
          case "days": return -(x.prediction.daysToMergeEst ?? 99);
        }
      };
      return P(b) - P(a);
    });
    return rows.slice(0, q.limit ?? 50);
  }

  async getIssue(id: number): Promise<RankedIssue | null> {
    return this.byId(id) ?? null;
  }

  async search(query: string, k: number): Promise<RankedIssue[]> {
    const toks = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = this.allRanked()
      .map((r) => {
        const hay = `${r.issue.title} ${r.issue.body ?? ""} ${r.repo.fullName} ${r.issue.labels.join(" ")}`.toLowerCase();
        const hits = toks.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
        return { r, hits, ev: r.prediction.evPerHour ?? 0 };
      })
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits || b.ev - a.ev);
    return scored.slice(0, k).map((x) => x.r);
  }

  async listTracked(): Promise<TrackedItem[]> {
    return this.tracked.map((t) => ({ ...t, issue: this.byId(t.issueId)?.issue ?? null }));
  }

  async createTrack(issueId: number): Promise<TrackedItem | null> {
    if (!this.byId(issueId)) return null;
    const item: TrackedItem = {
      id: this.trackedSeq++,
      issueId,
      workflowId: `bounty-lifecycle-${issueId}`,
      status: "CLAIMED",
      claimedAt: new Date().toISOString(),
      payoutStatus: "none",
    };
    this.tracked.push(item);
    return item;
  }

  async signalTrack(id: number, signal: TrackSignal): Promise<TrackedItem | null> {
    const item = this.tracked.find((t) => t.id === id);
    if (!item) return null;
    const next: Record<TrackSignal["type"], TrackStatus> = {
      prOpened: "PR_OPEN",
      maintainerComment: "IN_REVIEW",
      markMerged: "MERGED",
      markPaid: "PAID",
      abandon: "ABANDONED",
    };
    item.status = next[signal.type];
    if (signal.type === "prOpened") item.prUrl = String((signal.payload?.url as string) ?? item.prUrl ?? "");
    if (signal.type === "markPaid") item.payoutStatus = "paid";
    if (signal.type === "markMerged") item.payoutStatus = "pending";
    return item;
  }

  async getModelMetrics(): Promise<ModelMetrics> {
    return heuristicsMetrics(this.allRanked());
  }
}

function heuristicsMetrics(rows: RankedIssue[]): ModelMetrics {
  const positives = rows.filter((r) => (r.prediction.pSuccess ?? 0) >= 0.5).length;
  const evOf = (r: RankedIssue): number => r.prediction.evPerHour ?? 0;
  const N = Math.min(10, rows.length);
  // Fair comparison over the SAME N: follow the model's EV ranking vs. follow raw bounty size.
  const modelTopEv = mean([...rows].sort((a, b) => evOf(b) - evOf(a)).slice(0, N).map(evOf));
  const bountyTopEv = mean(
    [...rows].sort((a, b) => (b.issue.bountyAmount ?? 0) - (a.issue.bountyAmount ?? 0)).slice(0, N).map(evOf),
  );
  return {
    version: MODEL_VERSION,
    trainedAt: new Date().toISOString(),
    rows: rows.length,
    positiveRate: rows.length ? positives / rows.length : 0,
    classifier: { rocAuc: 0, prAuc: 0, calibrationEce: undefined },
    baselines: { bountyOnly: 0, logisticRegression: 0, gradientBoostedTrees: 0 },
    hoursSavedSim: {
      modelEvPerHour: round(modelTopEv, 3),
      bountyOnlyEvPerHour: round(bountyTopEv, 3),
      deltaPct: bountyTopEv > 0 ? round(((modelTopEv - bountyTopEv) / bountyTopEv) * 100, 1) : 0,
    },
  };
}

const mean = (a: number[]): number => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
