// BountyLifecycleWorkflow state-machine tests (PRD §1.6, §8). Runs without a
// Temporal server by testing the pure reducer the workflow uses.
import { describe, expect, it } from "vitest";
import {
  initialLifecycle,
  isTerminal,
  reduce,
  toWorkflowState,
  withDraft,
} from "./lifecycle.js";

const at = "2026-10-15T00:00:00.000Z";

describe("lifecycle state machine", () => {
  it("starts CLAIMED with a claimed timeline event", () => {
    const s = initialLifecycle(at);
    expect(s.status).toBe("CLAIMED");
    expect(s.payoutStatus).toBe("none");
    expect(s.timeline[0]?.kind).toBe("claimed");
  });

  it("walks the happy path CLAIMED -> PR_OPEN -> IN_REVIEW -> MERGED -> PAID", () => {
    let s = initialLifecycle(at);
    s = reduce(s, { type: "prOpened", at, payload: { url: "https://x/pull/1" } });
    expect(s.status).toBe("PR_OPEN");
    expect(s.prUrl).toBe("https://x/pull/1");
    s = reduce(s, { type: "maintainerComment", at });
    expect(s.status).toBe("IN_REVIEW");
    s = reduce(s, { type: "markMerged", at });
    expect(s.status).toBe("MERGED");
    expect(s.payoutStatus).toBe("pending");
    s = reduce(s, { type: "markPaid", at });
    expect(s.status).toBe("PAID");
    expect(s.payoutStatus).toBe("paid");
    expect(isTerminal(s.status)).toBe(true);
  });

  it("ignores illegal transitions but records them for audit", () => {
    let s = initialLifecycle(at);
    s = reduce(s, { type: "markPaid", at }); // can't pay while CLAIMED
    expect(s.status).toBe("CLAIMED");
    expect(s.timeline.some((e) => e.kind.startsWith("ignored:illegal"))).toBe(true);
  });

  it("prOpened is valid directly from CLAIMED (skips WORKING)", () => {
    const s = reduce(initialLifecycle(at), { type: "prOpened", at, payload: { url: "u" } });
    expect(s.status).toBe("PR_OPEN");
  });

  it("terminal states are frozen - later signals never resurrect", () => {
    let s = reduce(initialLifecycle(at), { type: "abandon", at });
    expect(isTerminal(s.status)).toBe(true);
    s = reduce(s, { type: "markMerged", at });
    expect(s.status).toBe("ABANDONED");
    expect(s.timeline.some((e) => e.kind === "ignored:terminal")).toBe(true);
  });

  it("reduce is pure: input state is not mutated", () => {
    const s = initialLifecycle(at);
    const before = s.timeline.length;
    reduce(s, { type: "prOpened", at, payload: { url: "u" } });
    expect(s.timeline.length).toBe(before);
  });

  it("withDraft attaches a follow-up without changing status", () => {
    const s = initialLifecycle(at);
    const t = withDraft(s, "ping maintainer", at);
    expect(t.status).toBe("CLAIMED");
    expect(t.pendingDraft).toBe("ping maintainer");
    expect(t.timeline.at(-1)?.kind).toBe("follow_up_drafted");
  });

  it("toWorkflowState maps a nextAction and exposes the timeline", () => {
    const s = reduce(initialLifecycle(at), { type: "prOpened", at, payload: { url: "u" } });
    const w = toWorkflowState("wf-1", 42, s);
    expect(w.workflowId).toBe("wf-1");
    expect(w.issueId).toBe(42);
    expect(w.status).toBe("PR_OPEN");
    expect(w.nextAction).toMatch(/review/i);
    expect(w.timeline.length).toBeGreaterThan(0);
  });
});
