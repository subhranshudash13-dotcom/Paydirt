// Real bounty-signal detection. Verified conventions (do not assume):
//  - Algora (https://algora.io) labels issues with emoji + amount, e.g.
//      "💎 $100"  "🏆 $500"  "🥇 $250"  "🐞 bounty" and sometimes plain "bounty".
//  - Some repos use a plain "bounty"/"$100" label or put the amount in the title/body.
// Amounts are parsed defensively; currency defaults to USD when a "$" is present.

const ALGORA_TIER: Record<string, string> = {
  "💎": "diamond",
  "🏆": "trophy",
  "🥇": "gold",
  "🥈": "silver",
  "🥉": "bronze",
  "🐞": "bug",
};

export interface ParsedBounty {
  amount: number | null;
  currency: string | null;
  source: "github_label" | "algora" | "serpapi";
  tier?: string;
}

const AMOUNT_RE = /[$€£]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/;

function amountFrom(text: string): number | null {
  const m = AMOUNT_RE.exec(text);
  if (!m || m[1] === undefined) return null;
  const n = Number.parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function detectBounty(labels: string[], title = ""): ParsedBounty | null {
  let best: ParsedBounty | null = null;
  for (const raw of labels) {
    const label = raw.trim().toLowerCase();
    const isAlgora = Object.keys(ALGORA_TIER).some((e) => raw.includes(e));
    const isBountyWord = label.includes("bounty") || /[$€£]\s?\d/.test(raw);
    if (!isAlgora && !isBountyWord) continue;
    const amount = amountFrom(raw);
    const tier = Object.entries(ALGORA_TIER).find(([e]) => raw.includes(e))?.[1];
    const cand: ParsedBounty = {
      amount: amount ?? null,
      currency: amount != null ? "USD" : null,
      source: isAlgora ? "algora" : "github_label",
      tier,
    };
    if (!best || (cand.amount ?? 0) > (best.amount ?? 0)) best = cand;
  }
  if (!best) {
    const fromTitle = amountFrom(title);
    if (fromTitle != null && /bounty|\$/.test(title)) {
      best = { amount: fromTitle, currency: "USD", source: "github_label" };
    }
  }
  return best;
}

export const GOOD_FIRST_ISSUE = new Set([
  "good first issue",
  "good-for-newcomers",
  "easy",
  "starter",
]);

export function hasGoodFirstIssue(labels: string[]): boolean {
  return labels.some((l) => GOOD_FIRST_ISSUE.has(l.trim().toLowerCase()));
}
