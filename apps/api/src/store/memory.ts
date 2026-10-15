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
} from "@paydirt/shared";
import { score, type ScoreInput } from "../scoring.js";
import { featuresFromSeed, SEED, type SeedRecord } from "../seed/data.js";
import type { Store } from "./types.js";

const MODEL_VERSION = "heuristic-v1";
const NEUTRAL_MATCH = 0.5; // real match needs an ingested profile (Loop 7)

interface Row {
  issue: Issue;
  repo: Repo;
  input: ScoreInput;
}

function buildRow(s: SeedRecord, id: number, repoId: number): Row {
  const bounty = detectBounty(s.labels, s.title);
  const bodyLength = s.body.length;
  const gfi = hasGoodFirstIssue(s.labels);
  const amount = bounty?.amount ?? 0;
  const features = featuresFromSeed(s, amount, bodyLength, gfi, s.issueAgeDays);
  const input: ScoreInput = { ...features, matchScore: NEUTRAL_MATCH };
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
  return { issue, repo, input };
}

const round = (x: number, p: number): number => Math.round(x * 10 ** p) / 10 ** p;

function toRanked(row: Row): RankedIssue {
  const out = score(row.input);
  return {
    issue: row.issue,
    repo: row.repo,
    prediction: {
      issueId: row.issue.id,
      modelVersion: MODEL_VERSION,
      pSuccess: round(out.pSuccess, 4),
      daysToMergeEst: round(out.daysToMergeEst, 2),
      evPerHour: round(out.evPerHour, 4),
      matchScore: NEUTRAL_MATCH,
      estHours: round(out.estHours, 2),
      features: row.input,
    },
  };
}

export class MemoryStore implements Store {
  readonly driver = "memory" as const;
  private rows: RankedIssue[];
  private tracked: TrackedItem[] = [];
  private trackedSeq = 1;

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
    this.rows = SEED.map((s, i) => toRanked(buildRow(s, i + 1, rid(s.fullName))));
  }

  private byId(id: number): RankedIssue | undefined {
    return this.rows.find((r) => r.issue.id === id);
  }

  async listBoard(q: BoardQuery): Promise<RankedIssue[]> {
    let rows = [...this.rows];
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
    const scored = this.rows
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
    return heuristicsMetrics(this.rows);
  }
}

function heuristicsMetrics(rows: RankedIssue[]): ModelMetrics {
  const positives = rows.filter((r) => (r.prediction.pSuccess ?? 0) >= 0.5).length;
  const modelEv = mean(rows.map((r) => r.prediction.evPerHour ?? 0));
  const byBounty = [...rows]
    .sort((a, b) => (b.issue.bountyAmount ?? 0) - (a.issue.bountyAmount ?? 0))
    .slice(0, 10);
  const bountyOnlyEv = mean(byBounty.map((r) => r.prediction.evPerHour ?? 0));
  return {
    version: MODEL_VERSION,
    trainedAt: new Date().toISOString(),
    rows: rows.length,
    positiveRate: rows.length ? positives / rows.length : 0,
    classifier: { rocAuc: 0, prAuc: 0, calibrationEce: undefined },
    baselines: { bountyOnly: 0, logisticRegression: 0, gradientBoostedTrees: 0 },
    hoursSavedSim: {
      modelEvPerHour: round(modelEv, 3),
      bountyOnlyEvPerHour: round(bountyOnlyEv, 3),
      deltaPct: bountyOnlyEv > 0 ? round(((modelEv - bountyOnlyEv) / bountyOnlyEv) * 100, 1) : 0,
    },
  };
}

const mean = (a: number[]): number => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
