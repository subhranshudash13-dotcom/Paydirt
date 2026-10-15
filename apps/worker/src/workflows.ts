// Temporal workflows (PRD §8). Deterministic orchestration only — every external
// side effect goes through an activity. BountyLifecycleWorkflow survives worker
// restarts (event-sourced by Temporal); signals/timers/queries drive a tracked
// bounty from CLAIMED to PAID/ABANDONED.
import {
  condition,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
  sleep,
} from "@temporalio/workflow";
import type * as activities from "./activities.js";
import {
  initialLifecycle,
  isTerminal,
  reduce,
  toWorkflowState,
  withDraft,
  type LifecycleSignal,
  type LifecycleState,
} from "./lifecycle.js";
import type { TimelineEvent, WorkflowState } from "@paydirt/shared";

const {
  checkPrStatus,
  draftFollowUp,
  enrichRepoAndMaintainerStats,
  embedIssues,
  rankAndStore,
  scoreIssues,
  searchGithubBounties,
  upsertIssues,
  buildTrainingRows,
  retrainModel,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: { initialInterval: "2s", backoffCoefficient: 2, maximumAttempts: 5 },
});

// ── BountyLifecycleWorkflow ──────────────────────────────────────────────────
export interface BountyInput {
  trackedId: number;
  issueId: number;
  repo: string;
  prNumber: number | null;
  title: string;
  body: string;
  followUpDays: number;
  abandonAfterDays: number;
  pollSeconds: number;
}

export const prOpened = defineSignal<[{ url: string }]>("prOpened");
export const maintainerComment = defineSignal<[]>("maintainerComment");
export const markMerged = defineSignal<[]>("markMerged");
export const markPaid = defineSignal<[]>("markPaid");
export const abandon = defineSignal<[]>("abandon");

export const getState = defineQuery<WorkflowState>("getState");
export const getTimeline = defineQuery<TimelineEvent[]>("getTimeline");

export async function BountyLifecycleWorkflow(input: BountyInput): Promise<WorkflowState> {
  let state: LifecycleState = initialLifecycle(new Date().toISOString());
  const workflowId = `bounty-lifecycle-${input.issueId}`;
  let wakeTick = 0; // bumped by any signal to wake the poll loop

  const apply = (sig: LifecycleSignal): void => {
    state = reduce(state, sig);
    wakeTick++;
  };

  setHandler(prOpened, (d) => apply({ type: "prOpened", at: new Date().toISOString(), payload: d }));
  setHandler(maintainerComment, () => apply({ type: "maintainerComment", at: new Date().toISOString() }));
  setHandler(markMerged, () => apply({ type: "markMerged", at: new Date().toISOString() }));
  setHandler(markPaid, () => apply({ type: "markPaid", at: new Date().toISOString() }));
  setHandler(abandon, () => apply({ type: "abandon", at: new Date().toISOString() }));

  setHandler(getState, () => toWorkflowState(workflowId, input.issueId, state));
  setHandler(getTimeline, () => state.timeline);

  let elapsedSeconds = 0;
  let followUpSent = false;
  let abandonSuggested = false;

  while (!isTerminal(state.status)) {
    const before = wakeTick;
    // Wake on the next signal OR the next poll timer, whichever first.
    await Promise.race([condition(() => wakeTick > before), sleep(`${input.pollSeconds}s`)]);

    // Poll real PR state (no-op offline). Auto-advance the machine on evidence.
    const poll = await checkPrStatus({ repo: input.repo, prNumber: input.prNumber });
    if (poll?.merged) apply({ type: "markMerged", at: new Date().toISOString() });
    else if (poll?.reviewed && state.status === "PR_OPEN") apply({ type: "maintainerComment", at: new Date().toISOString() });

    elapsedSeconds += input.pollSeconds;

    // Stalled? Draft a follow-up for the user to approve (never auto-post, PRD §1.8).
    if (!followUpSent && elapsedSeconds >= input.followUpDays * 86400 && !isTerminal(state.status)) {
      const text = await draftFollowUp({ title: input.title, body: input.body });
      state = withDraft(state, text, new Date().toISOString());
      wakeTick++;
      followUpSent = true;
    }
    // Long-stalled? Suggest abandoning (the user decides via the abandon signal).
    if (!abandonSuggested && elapsedSeconds >= input.abandonAfterDays * 86400 && !isTerminal(state.status)) {
      state = withDraft(state, `Stalled ${input.abandonAfterDays}+ days — consider abandoning and re-ranking alternatives.`, new Date().toISOString());
      wakeTick++;
      abandonSuggested = true;
    }
  }

  return toWorkflowState(workflowId, input.issueId, state);
}

// ── DiscoveryWorkflow (Schedule: every 6h) ───────────────────────────────────
export interface DiscoveryResult {
  source: "github" | "sample";
  discovered: number;
  embedded: number;
  persisted: number;
  scored: number;
  driver: "postgres" | "memory";
  top: Array<{ ref: string; pSuccess: number; modelVersion: string }>;
}

export async function DiscoveryWorkflow(query?: string): Promise<DiscoveryResult> {
  const issues = await searchGithubBounties(query);
  const enriched = await enrichRepoAndMaintainerStats(issues);
  const embedded = await embedIssues(enriched);
  const upsert = await upsertIssues(enriched);
  const predictions = await scoreIssues(enriched);

  const issueIdRefs = enriched.map((i) => ({
    ref: `${i.repo}#${i.number}`,
    issueId: upsert.ids[`${i.repo}#${i.number}`] ?? null,
  }));
  const rank = await rankAndStore(issueIdRefs, predictions);

  const top = [...predictions]
    .sort((a, b) => b.pSuccess - a.pSuccess)
    .slice(0, 10)
    .map((p) => ({ ref: p.ref, pSuccess: p.pSuccess, modelVersion: p.modelVersion }));

  return {
    source: upsert.driver === "postgres" ? "github" : "sample",
    discovered: enriched.length,
    embedded,
    persisted: rank.persisted,
    scored: predictions.length,
    driver: upsert.driver,
    top,
  };
}

// ── RetrainWorkflow (weekly) ─────────────────────────────────────────────────
export interface RetrainResult {
  ok: boolean;
  rows: number;
  metrics?: Record<string, unknown>;
  error?: string;
}

export async function RetrainWorkflow(): Promise<RetrainResult> {
  const rows = await buildTrainingRows();
  if (rows.length < 2) return { ok: false, rows: rows.length, error: "not enough labeled rows (Phase 1 gate)" };
  const res = await retrainModel(rows);
  return { ok: res.ok, rows: rows.length, metrics: res.metrics, error: res.error };
}
