import { detectBounty } from "@paydirt/shared";
import { config } from "../config.js";
import type { SeedRecord } from "../seed/data.js";

/**
 * Live bounty feed (PRD §7.1 "discover", made dynamic instead of the demo seed).
 *
 * Pulls REAL open issues from the public GitHub Search API, keeps only ones with a
 * parseable dollar bounty, and enriches each with live repo stats (stars/forks/
 * language/open-issue age). Unauthenticated search is heavily rate-limited, so we:
 *   • issue exactly ONE search per refresh,
 *   • cache repo lookups for the process lifetime,
 *   • and return null on any 403/network failure so the store honestly falls back
 *     to the seed + heuristic baseline (never fabricates data).
 *
 * Repo-health features the Search API does NOT expose (commits/30d, maintainer
 * response/merge priors) are filled with documented neutral priors — the full
 * Temporal collector is what backfills those in the real (Docker) path.
 */

const GH = "https://api.github.com";
const SEARCH_QUERY = "bounty state:open type:issue";

// Neutral priors for signals the Search API can't give us (disclosed in health/UI).
const DEFAULT_PRIORS = {
  commitsPrior30d: 0,
  maintMedianRespHours: 24,
  maintMergeRate: 0.5,
} as const;

const repoCache = new Map<string, RepoStats | null>();

interface RepoStats {
  fullName: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  repoAgeDays: number;
}

interface GhItem {
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  repository_url: string;
  comments: number;
  created_at: string;
  assignees?: { login: string }[];
  labels?: { name: string }[];
}

const daysSince = (iso: string): number => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "paydirt" };
  if (config.githubToken) h.authorization = `Bearer ${config.githubToken}`;
  return h;
}

/** Money token scanner: "$200", "$ 50", "$1,000" — takes the max across the text. */
const MONEY_RE = /[$€£]\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g;
function maxMoney(text: string | null | undefined): number | null {
  if (!text) return null;
  let best: number | null = null;
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(text)) !== null) {
    const n = Number.parseFloat((m[1] ?? "").replace(/,/g, ""));
    if (Number.isFinite(n) && (best == null || n > best)) best = n;
  }
  return best;
}

/**
 * Robust bounty amount: prefer label/title semantics, then fall back to any dollar
 * figure in labels, title, or body. detectBounty() can return a non-null result with
 * amount=null (a bare "bounty" label) that masks a title amount, so we scan too.
 */
function extractBountyAmount(labels: string[], title: string, body?: string | null): number | null {
  let best = detectBounty(labels, title)?.amount ?? null;
  for (const c of [maxMoney(labels.join(" ")), maxMoney(title), maxMoney(body?.slice(0, 600))]) {
    if (c != null && (best == null || c > best)) best = c;
  }
  return best;
}

async function jget<T>(url: string, ms = 6000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: ghHeaders(), signal: ctrl.signal });
    if (!res.ok) return null; // 403/404/rate-limited → null (caller degrades honestly)
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function repoStats(fullName: string): Promise<RepoStats | null> {
  if (repoCache.has(fullName)) return repoCache.get(fullName) ?? null;
  const d = await jget<{
    full_name: string; language?: string | null; stargazers_count?: number;
    forks_count?: number; open_issues_count?: number; created_at?: string;
  }>(`${GH}/repos/${fullName}`);
  const stats: RepoStats | null = d
    ? {
        fullName: d.full_name ?? fullName,
        language: d.language ?? "",
        stars: d.stargazers_count ?? 0,
        forks: d.forks_count ?? 0,
        openIssues: d.open_issues_count ?? 0,
        repoAgeDays: d.created_at ? daysSince(d.created_at) : 0,
      }
    : null;
  repoCache.set(fullName, stats);
  return stats;
}

/**
 * Fetch real bountied issues as SeedRecord-shaped rows (same type the store's
 * feature pipeline already consumes), or null when unavailable/rate-limited.
 */
export async function fetchLiveSeed(limit = 40): Promise<SeedRecord[] | null> {
  const search = await jget<{ items?: GhItem[] }>(
    `${GH}/search/issues?q=${encodeURIComponent(SEARCH_QUERY)}&sort=updated&order=desc&per_page=${limit}`,
  );
  const items = search?.items;
  if (!items || !items.length) return null;

  const out: SeedRecord[] = [];
  for (const it of items) {
    const labels = (it.labels ?? []).map((l) => l.name);
    const amount = extractBountyAmount(labels, it.title, it.body);
    if (amount == null || amount <= 0) continue; // keep only genuinely bountied issues
    const hasMoneyLabel = labels.some((l) => /[$€£]\s?\d/.test(l));

    const fullName = (it.repository_url ?? "").replace(`${GH}/repos/`, "");
    if (!fullName) continue;
    const rs = (await repoStats(fullName)) ?? {
      fullName, language: "", stars: 0, forks: 0, openIssues: 0, repoAgeDays: 0,
    };

    out.push({
      fullName: rs.fullName,
      language: rs.language,
      stars: rs.stars,
      forks: rs.forks,
      openIssues: rs.openIssues,
      repoAgeDays: rs.repoAgeDays,
      commitsPrior30d: DEFAULT_PRIORS.commitsPrior30d,
      maintMedianRespHours: DEFAULT_PRIORS.maintMedianRespHours,
      maintMergeRate: DEFAULT_PRIORS.maintMergeRate,
      number: it.number,
      title: it.title,
      body: (it.body ?? "").slice(0, 2000),
      labels: hasMoneyLabel ? labels : [...labels, `$${amount}`], // bridge: store re-parses the same amount
      commentCount: it.comments ?? 0,
      claimantCount: (it.assignees ?? []).length,
      issueAgeDays: it.created_at ? daysSince(it.created_at) : 0,
    });

    if (out.length >= 24) break; // enough for a rich, responsive board
  }
  return out.length ? out : null;
}
