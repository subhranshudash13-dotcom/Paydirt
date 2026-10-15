// GitHub REST client (PRD §8 discovery + §13 rate limits). Real calls when
// GITHUB_TOKEN is set; otherwise an honest built-in sample so DiscoveryWorkflow
// is demoable offline. Never invents endpoints — uses documented search/issues,
// repos, and pulls routes. Auth headers + conditional requests reduce rate pressure.
import { detectBounty } from "@paydirt/shared";
import { config } from "../config.js";
import type { DiscoveredIssue } from "../types.js";

const API = "https://api.github.com";

interface GhIssue {
  repository_url: string;
  html_url: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: { name: string }[];
  comments: number;
  created_at: string;
  repository_id?: number;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "paydirt-worker",
  };
  if (config.githubToken) h.Authorization = `Bearer ${config.githubToken}`;
  return h;
}

// Illustrative sample of real repos that run Algora-style bounties. Used ONLY
// when no GITHUB_TOKEN is present so the pipeline is demoable offline; the live
// path (with a token) replaces this with the Search API results.
const SAMPLE: DiscoveredIssue[] = [
  { repo: "calcom/cal.com", number: 1042, title: "Fix timezone rendering in booking link", body: "Steps to reproduce…", url: "https://github.com/calcom/cal.com/issues/1042", state: "open", labels: ["💎 $150", "bug"], createdAt: "2026-09-01T00:00:00Z", commentCount: 4, claimantCount: 2, bountyAmount: 150, bountySource: "algora", repoStars: 34000, repoForks: 6800, language: "TypeScript", openIssueCount: 480 },
  { repo: "lobehub/lobe-chat", number: 2880, title: "Add provider for new open-weight model", body: "We want to support…", url: "https://github.com/lobehub/lobe-chat/issues/2880", state: "open", labels: ["🏆 $500"], createdAt: "2026-09-05T00:00:00Z", commentCount: 9, claimantCount: 1, bountyAmount: 500, bountySource: "algora", repoStars: 52000, repoForks: 11000, language: "TypeScript", openIssueCount: 320 },
  { repo: "polars-dataframe/polars", number: 19123, title: "Streaming groupby memory regression", body: "Memory grows with…", url: "https://github.com/pola-rs/polars/issues/19123", state: "open", labels: ["🥈 $100"], createdAt: "2026-09-12T00:00:00Z", commentCount: 6, claimantCount: 3, bountyAmount: 100, bountySource: "algora", repoStars: 29000, repoForks: 1700, language: "Rust", openIssueCount: 900 },
  { repo: "grafana/grafana", number: 81234, title: "Panel options search is slow", body: "Typing lag when…", url: "https://github.com/grafana/grafana/issues/81234", state: "open", labels: ["good first issue", "bounty $250"], createdAt: "2026-09-18T00:00:00Z", commentCount: 2, claimantCount: 0, bountyAmount: 250, bountySource: "github_label", repoStars: 64000, repoForks: 12500, language: "Go", openIssueCount: 4100 },
];

export async function searchBounties(query = "label:bounty state:open"): Promise<{
  source: "github" | "sample";
  issues: DiscoveredIssue[];
  rateRemaining: number | null;
}> {
  if (!config.githubToken) {
    return { source: "sample", issues: SAMPLE, rateRemaining: null };
  }
  try {
    const res = await fetch(`${API}/search/issues?q=${encodeURIComponent(query)}&per_page=50`, {
      headers: headers(),
      signal: AbortSignal.timeout(15000),
    });
    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "");
    if (!res.ok) throw new Error(`github search ${res.status}`);
    const data = (await res.json()) as { items: GhIssue[] };
    const issues: DiscoveredIssue[] = [];
    for (const it of data.items) {
      const labels = it.labels.map((l) => l.name);
      const bounty = detectBounty(labels, it.title);
      const repo = (it.repository_url ?? "").replace(`${API}/repos/`, "");
      if (!bounty || !repo) continue;
      issues.push({
        repo, number: it.number, title: it.title, body: it.body ?? "", url: it.html_url,
        state: it.state === "closed" ? "closed" : "open", labels, createdAt: it.created_at,
        commentCount: it.comments ?? 0, claimantCount: 0, bountyAmount: bounty.amount ?? 0,
        bountySource: bounty.source, repoStars: 0, repoForks: 0, language: "", openIssueCount: 0,
      });
    }
    return { source: "github", issues, rateRemaining: Number.isFinite(remaining) ? remaining : null };
  } catch {
    // Rate-limited or errored: fall back to the sample rather than failing the workflow.
    return { source: "sample", issues: SAMPLE, rateRemaining: null };
  }
}

export async function repoStats(repo: string): Promise<{ stars: number; forks: number; language: string; openIssues: number } | null> {
  if (!config.githubToken) return null;
  try {
    const res = await fetch(`${API}/repos/${repo}`, { headers: headers(), signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const r = (await res.json()) as { stargazers_count: number; forks_count: number; language: string | null; open_issues_count: number };
    return { stars: r.stargazers_count, forks: r.forks_count, language: r.language ?? "", openIssues: r.open_issues_count };
  } catch {
    return null;
  }
}

export interface PrStatus {
  prUrl: string | null;
  merged: boolean;
  reviewed: boolean;
  commentSinceLastSeen: boolean;
}

export async function checkPr(repo: string, prNumber: number | null): Promise<PrStatus | null> {
  if (!config.githubToken || prNumber == null) return null;
  try {
    const res = await fetch(`${API}/repos/${repo}/pulls/${prNumber}`, { headers: headers(), signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const r = (await res.json()) as { html_url: string; merged: boolean; comments: number; review_comments: number };
    return { prUrl: r.html_url, merged: !!r.merged, reviewed: (r.review_comments ?? 0) > 0, commentSinceLastSeen: (r.comments ?? 0) > 0 };
  } catch {
    return null;
  }
}
