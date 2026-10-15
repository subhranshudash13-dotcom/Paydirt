// BountyLifecycleWorkflow state machine (PRD §8). Pure and deterministic so it
// (a) runs inside the Temporal workflow sandbox and (b) is unit-testable without
// a server. Only type imports from @paydirt/shared — no zod runtime here.
import type { PayoutStatus, SignalType, TimelineEvent, TrackStatus, WorkflowState } from "@paydirt/shared";

export interface LifecycleState {
  status: TrackStatus;
  payoutStatus: PayoutStatus;
  prUrl?: string;
  pendingDraft?: string;
  timeline: TimelineEvent[];
}

export interface LifecycleSignal {
  type: SignalType;
  at: string;
  payload?: Record<string, unknown>;
}

// Which source states each signal may fire from → target state. Anything else
// is either recorded as an event (auditable) or ignored (terminal).
const SIGNAL_TARGET: Record<SignalType, { to: TrackStatus; from: TrackStatus[] } | null> = {
  prOpened: { to: "PR_OPEN", from: ["CLAIMED", "WORKING"] },
  maintainerComment: { to: "IN_REVIEW", from: ["PR_OPEN"] },
  markMerged: { to: "MERGED", from: ["PR_OPEN", "IN_REVIEW"] },
  markPaid: { to: "PAID", from: ["MERGED", "PAYOUT_PENDING"] },
  abandon: {
    to: "ABANDONED",
    from: ["CLAIMED", "WORKING", "PR_OPEN", "IN_REVIEW", "MERGED", "PAYOUT_PENDING"],
  },
};

const TERMINAL: TrackStatus[] = ["PAID", "ABANDONED"];

export function isTerminal(status: TrackStatus): boolean {
  return TERMINAL.includes(status);
}

export function initialLifecycle(nowIso: string): LifecycleState {
  return {
    status: "CLAIMED",
    payoutStatus: "none",
    timeline: [{ at: nowIso, kind: "claimed", detail: "Bounty claimed; lifecycle started" }],
  };
}

/**
 * Fold one signal into state. Never throws. Returns a NEW state (immutable so
 * workflow replay stays deterministic). Invalid transitions are recorded in the
 * timeline (with kind "ignored:<reason>") but never move the state machine
 * backwards or into an illegal state.
 */
export function reduce(state: LifecycleState, signal: LifecycleSignal): LifecycleState {
  const rule = SIGNAL_TARGET[signal.type];
  const detail = describeSignal(signal);

  // Terminal: nothing changes anything, but we still log it for audit.
  if (isTerminal(state.status)) {
    return { ...state, timeline: appendTimeline(state, signal.at, `ignored:terminal`, detail) };
  }

  // No mapping for this signal kind → just log.
  if (!rule) {
    return { ...state, timeline: appendTimeline(state, signal.at, `ignored:no-op`, detail) };
  }

  // Signal arrived but state not eligible (e.g. markPaid while WORKING) → log.
  if (!rule.from.includes(state.status)) {
    return {
      ...state,
      timeline: appendTimeline(state, signal.at, `ignored:illegal:${state.status}->${rule.to}`, detail),
    };
  }

  const next: LifecycleState = {
    ...state,
    status: rule.to,
    timeline: appendTimeline(state, signal.at, rule.to, detail),
  };
  if (signal.type === "prOpened") {
    const url = (signal.payload?.["url"] as string | undefined) ?? undefined;
    if (url) next.prUrl = url;
  }
  if (rule.to === "MERGED") next.payoutStatus = "pending";
  if (rule.to === "PAID") next.payoutStatus = "paid";
  if (rule.to === "ABANDONED") next.payoutStatus = "failed";
  return next;
}

/**
 * Timer hook: called when the follow-up timer fires and the workflow asks an
 * activity to draft a nudge. Records the draft without changing status.
 */
export function withDraft(state: LifecycleState, draftText: string, at: string): LifecycleState {
  return {
    ...state,
    pendingDraft: draftText,
    timeline: appendTimeline(state, at, "follow_up_drafted", "Gemma wrote a follow-up draft for approval"),
  };
}

export function toWorkflowState(workflowId: string, issueId: number, s: LifecycleState): WorkflowState {
  const nextAction: WorkflowState["nextAction"] = (() => {
    switch (s.status) {
      case "CLAIMED":
      case "WORKING":
        return "Open a PR (Draft is in the Detail panel)";
      case "PR_OPEN":
        return "Awaiting maintainer review";
      case "IN_REVIEW":
        return "Address review comments";
      case "MERGED":
        return "Awaiting bounty payout";
      case "PAYOUT_PENDING":
        return "Payout pending";
      case "PAID":
        return "Completed";
      case "ABANDONED":
        return "Abandoned";
    }
  })();
  return {
    workflowId,
    status: s.status,
    issueId,
    prUrl: s.prUrl ?? null,
    payoutStatus: s.payoutStatus,
    nextAction,
    pendingDraft: s.pendingDraft ?? null,
    timeline: s.timeline,
  };
}

function appendTimeline(state: LifecycleState, at: string, kind: string, detail?: string): TimelineEvent[] {
  return [...state.timeline, { at, kind, detail: detail ?? null }];
}

function describeSignal(signal: LifecycleSignal): string {
  switch (signal.type) {
    case "prOpened":
      return `PR opened ${signal.payload?.["url"] ?? ""}`.trim();
    case "maintainerComment":
      return "Maintainer commented";
    case "markMerged":
      return "Linked PR merged";
    case "markPaid":
      return "Bounty paid";
    case "abandon":
      return "Bounty abandoned";
  }
}
