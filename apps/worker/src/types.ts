// Activity payload shapes (Temporal-serializable JSON only). Kept minimal.
import type { FeatureRow } from "@paydirt/shared";

export interface DiscoveredIssue {
  repo: string; // full_name, e.g. calcom/cal.com
  number: number;
  title: string;
  body: string;
  url: string;
  state: "open" | "closed";
  labels: string[];
  createdAt: string; // ISO
  commentCount: number;
  claimantCount: number;
  bountyAmount: number;
  bountySource: "github_label" | "algora" | "serpapi";
  repoStars: number;
  repoForks: number;
  language: string;
  openIssueCount: number;
}

export interface FeatureRef {
  ref: string; // repo#number
  issueId: number | null; // DB id if persisted, else null
  features: FeatureRow;
}

export interface UpsertResult {
  driver: "postgres" | "memory";
  received: number;
  persisted: number;
  // ref (repo#number) -> DB issue id, when persisted, so predictions can be stored.
  ids: Record<string, number>;
}
