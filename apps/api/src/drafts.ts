// Drafting (PRD §9). Gemma (Ollama) writes a plan when it's up; otherwise we return
// an honest, clearly-labelled template so the UI still shows something real without
// pretending a cloud LLM wrote it. NEVER posts to GitHub — dry-run only (PRD §1.8).
import type { RankedIssue, Draft } from "@paydirt/shared";
import { generate } from "./clients/ollama.js";
import { config } from "./config.js";

export function planPrompt(r: RankedIssue): string {
  const lines = [
    "You are helping a contributor plan work on a paid open-source issue.",
    "Write a concise, concrete implementation plan (bullet points): understanding,",
    "files/areas to touch, an approach, edge cases, and how you'd verify it.",
    "Do not post anything; this is a draft for the contributor to review.",
    "",
    `Repo: ${r.repo.fullName} (${r.repo.language ?? "unknown"})`,
    `Issue #${r.issue.number}: ${r.issue.title}`,
    `Bounty: ${r.issue.bountyAmount ?? 0} ${r.issue.bountyCurrency ?? "USD"}`,
    `Labels: ${r.issue.labels.join(", ") || "none"}`,
    `Body:\n${(r.issue.body ?? "").slice(0, 1200)}`,
  ];
  return lines.join("\n");
}

/** Deterministic, useful fallback plan when Ollama/Gemma is offline. */
export function templatePlan(r: RankedIssue): string {
  const lang = r.repo.language ?? "the project language";
  return [
    `# Plan — ${r.issue.title}`,
    `Repo: ${r.repo.fullName} · Issue #${r.issue.number} · Bounty ${r.issue.bountyAmount ?? 0}${(r.issue.bountyCurrency ?? "USD") === "USD" ? "$" : ""}`,
    "",
    "Understanding:",
    `- ${r.issue.body?.slice(0, 240).replace(/\s+/g, " ") ?? "(no body)"}…`,
    "",
    "Approach:",
    `1. Reproduce the current behavior and add a failing test in ${lang}.`,
    "2. Identify the owning module(s) from the stack trace / linked code.",
    "3. Implement the minimal change; keep the public API backward compatible.",
    "4. Handle edge cases called out in the thread; update docs if behavior changes.",
    "",
    "Verification:",
    "- Run the repo's test suite + lint locally; capture before/after in the PR.",
    `- Draft PR description referencing "#${r.issue.number}" for auto-closure.`,
    "",
    "(Local Gemma was offline — this is a template scaffold. Approve, edit, or regenerate.)",
  ].join("\n");
}

export async function planDraft(issue: RankedIssue): Promise<Draft> {
  const gemma = await generate(planPrompt(issue));
  if (gemma) {
    return {
      issueId: issue.issue.id,
      kind: "plan",
      text: gemma,
      model: `${config.gemmaChatModel} (Ollama)`,
      dryRun: true,
    };
  }
  return {
    issueId: issue.issue.id,
    kind: "plan",
    text: templatePlan(issue),
    model: "template (Ollama offline)",
    dryRun: true,
  };
}
