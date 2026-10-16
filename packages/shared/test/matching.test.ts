import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  tokenize,
  skillOverlap,
  languageMatch,
  combineMatch,
  bestEmbeddingCosine,
  computeMatch,
  type UserProfile,
  type UserChunk,
} from "../src/matching";

describe("cosineSimilarity", () => {
  it("is 1 for identical direction and 0 for orthogonal", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
  it("handles degenerate input", () => {
    expect(cosineSimilarity([], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe("tokenize", () => {
  it("lowercases, drops stop words and short noise", () => {
    const t = tokenize("Add OAuth SSO support for the team");
    expect(t).toContain("oauth");
    expect(t).toContain("sso");
    expect(t).not.toContain("the");
    expect(t).not.toContain("for");
  });
});

describe("skillOverlap", () => {
  it("scores 0 with no skills", () => {
    expect(skillOverlap("anything here", [])).toBe(0);
  });
  it("rises with more matched skill tokens", () => {
    const skills = ["oauth", "sso", "security", "auth"];
    const low = skillOverlap("fix the login button color", skills);
    const high = skillOverlap("implement oauth sso security auth flow", skills);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
  });
});

describe("languageMatch", () => {
  it("1 when language is in the user set, low otherwise, 0 when empty", () => {
    expect(languageMatch("TypeScript", ["typescript", "go"])).toBe(1);
    expect(languageMatch("Rust", ["typescript"])).toBeCloseTo(0.15, 5);
    expect(languageMatch("Rust", [])).toBe(0);
  });
});

describe("combineMatch", () => {
  it("renormalizes to skills+language when embedding is absent", () => {
    const offline = combineMatch({ language: 1, skills: 1, embedding: null });
    expect(offline).toBeCloseTo(1, 5);
    const partial = combineMatch({ language: 0.15, skills: 0, embedding: null });
    expect(partial).toBeCloseTo(0.35 * 0.15, 5);
  });
  it("uses the documented weights when an embedding is present", () => {
    const e = combineMatch({ language: 1, skills: 1, embedding: 1 });
    expect(e).toBeCloseTo(1, 5);
  });
});

describe("computeMatch", () => {
  const profile: UserProfile = {
    login: "octo", skills: ["oauth", "sso", "security", "auth"],
    languages: ["typescript", "go"], source: "github", ingestedAt: "2026-10-15T00:00:00.000Z",
  };

  it("returns null without a profile (caller falls back to neutral)", () => {
    expect(computeMatch({ language: "TypeScript", title: "x", body: "y", labels: [] }, null)).toBeNull();
  });

  it("blends language + skill overlap offline", () => {
    const m = computeMatch(
      { language: "TypeScript", title: "Add SAML SSO auth", body: "oauth security", labels: ["security"] },
      profile,
    );
    expect(m).not.toBeNull();
    expect(m!.language).toBe(1);
    expect(m!.skills).toBeGreaterThan(0);
    expect(m!.embedding).toBeNull();
    expect(m!.score).toBeGreaterThan(0);
  });

  it("favors a matching-language, matching-skill issue over an unrelated one", () => {
    const good = computeMatch(
      { language: "Go", title: "oauth sso auth security handler", body: "security", labels: [] },
      profile,
    )!;
    const bad = computeMatch(
      { language: "Rust", title: "docs typo in README", body: "typo", labels: ["A-docs"] },
      profile,
    )!;
    expect(good.score).toBeGreaterThan(bad.score);
  });

  it("uses embedding cosine when chunks carry vectors", () => {
    const chunks: UserChunk[] = [{ source: "repo", content: "c", embedding: [1, 0, 0] }];
    const m = computeMatch(
      { language: "TypeScript", title: "x", body: "y", labels: [] },
      profile,
      [1, 0, 0],
      chunks,
    );
    expect(m!.embedding).toBeCloseTo(1, 5);
  });

  it("bestEmbeddingCosine returns null with no vectors", () => {
    expect(bestEmbeddingCosine(null, [])).toBeNull();
    expect(bestEmbeddingCosine([1, 2], [{ source: "a", content: "b", embedding: null }])).toBeNull();
  });
});
