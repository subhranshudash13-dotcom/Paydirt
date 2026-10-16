import { z } from "zod";

// ─── Enums / literals ────────────────────────────────────────────────────────
export const BountySource = z.enum(["github_label", "algora", "serpapi"]);
export type BountySource = z.infer<typeof BountySource>;

// BountyLifecycleWorkflow states (PRD §8)
export const TrackStatus = z.enum([
  "CLAIMED",
  "WORKING",
  "PR_OPEN",
  "IN_REVIEW",
  "MERGED",
  "PAYOUT_PENDING",
  "PAID",
  "ABANDONED",
]);
export type TrackStatus = z.infer<typeof TrackStatus>;

export const PayoutStatus = z.enum(["none", "pending", "paid", "failed"]);
export type PayoutStatus = z.infer<typeof PayoutStatus>;

export const SortKey = z.enum(["ev", "p", "bounty", "match", "days"]);
export type SortKey = z.infer<typeof SortKey>;

// ─── Core entities ───────────────────────────────────────────────────────────
export const Repo = z.object({
  id: z.number(),
  fullName: z.string(),
  stars: z.number(),
  forks: z.number(),
  language: z.string().nullish(),
  openIssues: z.number().default(0),
  lastPushAt: z.string().nullish(),
});
export type Repo = z.infer<typeof Repo>;

export const Issue = z.object({
  id: z.number(),
  repoId: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullish(),
  url: z.string(),
  state: z.enum(["open", "closed"]),
  labels: z.array(z.string()).default([]),
  bountyAmount: z.number().nullish(),
  bountyCurrency: z.string().nullish(),
  bountySource: BountySource.nullish(),
  createdAt: z.string().nullish(),
  closedAt: z.string().nullish(),
  commentCount: z.number().default(0),
  claimantCount: z.number().default(0),
  linkedPrMerged: z.boolean().nullish(),
  mergedAt: z.string().nullish(),
  hasGoodFirstIssue: z.boolean().default(false),
});
export type Issue = z.infer<typeof Issue>;

// Snapshot-time feature row (what goes to TabPFN: anonymous numbers/cats only).
export const FeatureRow = z.object({
  bountyAmount: z.number(),
  repoStars: z.number(),
  repoForks: z.number(),
  repoAgeDays: z.number(),
  language: z.string(),
  issueAgeDaysAtSnapshot: z.number(),
  commentCountAtSnapshot: z.number(),
  claimantCountAtSnapshot: z.number(),
  bodyLength: z.number(),
  hasGoodFirstIssueLabel: z.boolean(),
  maintainerMedianFirstResponseHoursPrior90d: z.number(),
  maintainerMergeRatePrior90d: z.number(),
  repoCommitsPrior30d: z.number(),
  openIssueCount: z.number(),
});
export type FeatureRow = z.infer<typeof FeatureRow>;

export const Prediction = z.object({
  issueId: z.number(),
  modelVersion: z.string(),
  pSuccess: z.number().min(0).max(1),
  daysToMergeEst: z.number().nullish(),
  evPerHour: z.number().nullish(),
  matchScore: z.number().min(0).max(1).nullish(),
  estHours: z.number().nullish(),
  features: FeatureRow.partial().optional(),
});
export type Prediction = z.infer<typeof Prediction>;

// A single ranked row for the Board screen.
export const RankedIssue = z.object({
  issue: Issue,
  repo: Repo,
  prediction: Prediction,
});
export type RankedIssue = z.infer<typeof RankedIssue>;

// ─── Queries ─────────────────────────────────────────────────────────────────
export const BoardQuery = z.object({
  minEv: z.coerce.number().min(0).optional(),
  language: z.string().optional(),
  sort: SortKey.default("ev"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type BoardQuery = z.infer<typeof BoardQuery>;

// ─── Tracking / workflows ────────────────────────────────────────────────────
export const TimelineEvent = z.object({
  at: z.string(),
  kind: z.string(),
  detail: z.string().nullish(),
});
export type TimelineEvent = z.infer<typeof TimelineEvent>;

export const WorkflowState = z.object({
  workflowId: z.string(),
  status: TrackStatus,
  issueId: z.number(),
  prUrl: z.string().nullish(),
  payoutStatus: PayoutStatus.default("none"),
  nextAction: z.string().nullish(),
  pendingDraft: z.string().nullish(),
  timeline: z.array(TimelineEvent).default([]),
});
export type WorkflowState = z.infer<typeof WorkflowState>;

export const TrackedItem = z.object({
  id: z.number(),
  issueId: z.number(),
  workflowId: z.string().nullish(),
  status: TrackStatus,
  claimedAt: z.string(),
  prUrl: z.string().nullish(),
  payoutStatus: PayoutStatus,
  notes: z.string().nullish(),
  issue: Issue.nullish(),
});
export type TrackedItem = z.infer<typeof TrackedItem>;

export const SignalType = z.enum([
  "prOpened",
  "maintainerComment",
  "markMerged",
  "markPaid",
  "abandon",
]);
export type SignalType = z.infer<typeof SignalType>;

export const TrackSignal = z.object({
  type: SignalType,
  payload: z.record(z.unknown()).optional(),
});
export type TrackSignal = z.infer<typeof TrackSignal>;

// ─── Model reporting ─────────────────────────────────────────────────────────
export const ModelMetrics = z.object({
  version: z.string(),
  trainedAt: z.string(),
  rows: z.number(),
  positiveRate: z.number(),
  classifier: z.object({
    rocAuc: z.number(),
    prAuc: z.number(),
    calibrationEce: z.number().nullish(),
  }),
  baselines: z.object({
    bountyOnly: z.number(),
    logisticRegression: z.number(),
    gradientBoostedTrees: z.number(),
  }),
  hoursSavedSim: z.object({
    modelEvPerHour: z.number(),
    bountyOnlyEvPerHour: z.number(),
    deltaPct: z.number(),
  }),
});
export type ModelMetrics = z.infer<typeof ModelMetrics>;

// ─── Drafts ──────────────────────────────────────────────────────────────────
export const Draft = z.object({
  issueId: z.number(),
  kind: z.enum(["plan", "pr_description", "follow_up"]),
  text: z.string(),
  model: z.string(),
  dryRun: z.boolean().default(true),
});
export type Draft = z.infer<typeof Draft>;

// ─── API envelopes ───────────────────────────────────────────────────────────
export const HealthResponse = z.object({
  ok: z.boolean(),
  db: z.enum(["postgres", "memory", "down"]),
  temporal: z.boolean(),
  predictor: z.boolean(),
  ollama: z.boolean(),
  sentry: z.boolean().default(false),
  dataSource: z.enum(["live-github", "seed", "postgres"]).default("seed"),
  modelVersion: z.string().default("heuristic-v1"),
  issueCount: z.number().default(0),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export * from "./labels.js";
export * from "./matching.js";
