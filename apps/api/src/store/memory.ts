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
import type { Predictor, SidecarPrediction } from "../live/predictor.js";

const HEURISTIC_VERSION = "heuristic-v1";
const NEUTRAL_MATCH = 0.5; // used until a profile is ingested (Loop 7)
const PREDICTOR_TTL_MS = 15_000; // batch one sidecar call per window, not per request

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

/** Assign stable per-board repo ids from a record set (used for seed + live). */
function buildRows(records: SeedRecord[]): Row[] {
  const repoIds = new Map<string, number>();
  const rid = (fn: string): number => {
    let v = repoIds.get(fn);
    if (!v) {
      v = repoIds.size + 1;
      repoIds.set(fn, v);
    }
    return v;
  };
  return records.map((s, i) => buildRow(s, i + 1, rid(s.fullName)));
}

const round = (x: number, p: number): number => Math.round(x * 10 ** p) / 10 ** p;
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export class MemoryStore implements Store {
  readonly driver = "memory" as const;
  private baseRows: Row[];
  private tracked: TrackedItem[] = [];
  private trackedSeq = 1;
  private matcher: MatchResolver | null = null;
  private predictor: Predictor | null = null;
  private predCache: { at: number; map: Map<string, SidecarPrediction> | null } | null = null;
  private source: "live-github" | "seed" = "seed";
  private lastModelVersion = HEURISTIC_VERSION;

  constructor() {
    this.baseRows = buildRows(SEED);
  }

  get dataSource(): "live-github" | "seed" {
    return this.source;
  }
  get modelVersion(): string {
    return this.lastModelVersion;
  }
  get rowCount(): number {
    return this.baseRows.length;
  }

  attachMatcher(m: MatchResolver | null): void {
    this.matcher = m;
  }

  /** Attach the TabPFN/logistic sidecar client so predictions become model-served. */
  attachPredictor(fn: Predictor | null): void {
    this.predictor = fn;
    this.predCache = null;
    this.lastModelVersion = HEURISTIC_VERSION;
  }

  /** Swap the board's underlying records for real, live GitHub data. */
  reloadSeed(records: SeedRecord[], source: "live-github" | "seed"): void {
    this.baseRows = buildRows(records);
    this.source = source;
    this.predCache = null; // ids changed → drop stale predictions
  }

  /** Batched sidecar predictions over the whole row set (short TTL cache). */
  private async predictions(): Promise<Map<string, SidecarPrediction> | null> {
    if (!this.predictor) return null;
    if (this.predCache && Date.now() - this.predCache.at < PREDICTOR_TTL_MS) return this.predCache.map;
    const rows = this.baseRows.map((r) => ({ ref: String(r.issue.id), features: r.features }));
    const map = await this.predictor(rows);
    this.predCache = { at: Date.now(), map };
    this.lastModelVersion = map && map.size ? [...map.values()][0]!.modelVersion : HEURISTIC_VERSION;
    return map;
  }

  /** Compute a ranked row: real match_score + sidecar-served p/days when available. */
  private rankedOf(row: Row, pred: SidecarPrediction | null): RankedIssue {
    const m = this.matcher?.({
      language: row.repo.language,
      title: row.issue.title,
      body: row.issue.body ?? "",
      labels: row.issue.labels,
    });
    const matchScore = m?.score ?? NEUTRAL_MATCH;
    const base = score({ ...row.features, matchScore });
    const pSuccess = pred?.pSuccess ?? base.pSuccess;
    const daysToMergeEst = pred?.daysToMergeEst ?? base.daysToMergeEst;
    const bounty = row.features.bountyAmount ?? 0;
    const evPerHour = (pSuccess * bounty * (0.5 + 0.5 * clamp01(matchScore))) / base.estHours;
    return {
      issue: row.issue,
      repo: row.repo,
      prediction: {
        issueId: row.issue.id,
        modelVersion: pred?.modelVersion ?? HEURISTIC_VERSION,
        pSuccess: round(pSuccess, 4),
        daysToMergeEst: round(daysToMergeEst, 2),
        evPerHour: round(evPerHour, 4),
        matchScore: round(matchScore, 4),
        estHours: round(base.estHours, 2),
        features: row.features,
      },
    };
  }

  private async allRanked(): Promise<RankedIssue[]> {
    const map = await this.predictions();
    return this.baseRows.map((r) => this.rankedOf(r, map?.get(String(r.issue.id)) ?? null));
  }

  async listBoard(q: BoardQuery): Promise<RankedIssue[]> {
    let rows = await this.allRanked();
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
    const rows = await this.allRanked();
    return rows.find((r) => r.issue.id === id) ?? null;
  }

  async search(query: string, k: number): Promise<RankedIssue[]> {
    const toks = query.toLowerCase().split(/\s+/).filter(Boolean);
    const all = await this.allRanked();
    const scored = all
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
    const out: TrackedItem[] = [];
    for (const t of this.tracked) {
      const found = await this.getIssue(t.issueId);
      out.push({ ...t, issue: found?.issue ?? null });
    }
    return out;
  }

  async createTrack(issueId: number): Promise<TrackedItem | null> {
    if (!(await this.getIssue(issueId))) return null;
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
    return modelMetrics(await this.allRanked(), this.lastModelVersion);
  }
}

function modelMetrics(rows: RankedIssue[], version: string): ModelMetrics {
  const positives = rows.filter((r) => (r.prediction.pSuccess ?? 0) >= 0.5).length;
  const evOf = (r: RankedIssue): number => r.prediction.evPerHour ?? 0;
  const N = Math.min(10, rows.length);
  // Fair comparison over the SAME N: follow the model's EV ranking vs. follow raw bounty size.
  const modelTopEv = mean([...rows].sort((a, b) => evOf(b) - evOf(a)).slice(0, N).map(evOf));
  const bountyTopEv = mean(
    [...rows].sort((a, b) => (b.issue.bountyAmount ?? 0) - (a.issue.bountyAmount ?? 0)).slice(0, N).map(evOf),
  );
  return {
    version,
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
