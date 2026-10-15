import { describe, it, expect } from "vitest";
import { detectBounty, hasGoodFirstIssue } from "../src/labels";

describe("detectBounty", () => {
  it("parses Algora emoji bounty labels", () => {
    const b = detectBounty(["feature request", "💎 $150"]);
    expect(b).not.toBeNull();
    expect(b?.amount).toBe(150);
    expect(b?.source).toBe("algora");
    expect(b?.tier).toBe("diamond");
  });

  it("prefers the highest bounty when multiple labels exist", () => {
    const b = detectBounty(["🥈 $25", "🏆 $500"]);
    expect(b?.amount).toBe(500);
  });

  it("detects plain bounty labels", () => {
    const b = detectBounty(["bounty", "good first issue"]);
    expect(b?.source).toBe("github_label");
  });

  it("returns null for non-bounty issues", () => {
    expect(detectBounty(["bug", "help wanted"])).toBeNull();
  });

  it("falls back to title amount", () => {
    const b = detectBounty([], "Fix crash ($200 bounty)");
    expect(b?.amount).toBe(200);
  });
});

describe("hasGoodFirstIssue", () => {
  it("matches normalized labels", () => {
    expect(hasGoodFirstIssue(["Good First Issue"])).toBe(true);
    expect(hasGoodFirstIssue(["enhancement"])).toBe(false);
  });
});
