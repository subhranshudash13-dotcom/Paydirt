// Local profile service (PRD §9). ingestUserProfile: read the user's PUBLIC repo
// metadata (real GitHub call), derive skill/topic tokens + languages, chunk them,
// and embed with EmbeddingGemma when Ollama is up. The active profile turns the
// board's match_score from a neutral constant into a real, skill-aware signal.
//
// Nothing here leaves the machine except a public-repos query. If Ollama is down
// we simply skip embeddings (match then uses language + skill overlap) and say so.
import {
  tokenize,
  computeMatch,
  type MatchBreakdown,
  type UserProfile,
  type UserChunk,
} from "@paydirt/shared";
import { listUserRepos } from "./clients/github.js";
import { embed } from "./clients/ollama.js";

export interface ActiveProfile {
  profile: UserProfile;
  chunks: UserChunk[];
}

export interface IngestResult {
  ok: boolean;
  login: string;
  source: "github" | "unreachable";
  reason?: string;
  repoCount: number;
  languages: string[];
  skills: string[];
  chunkCount: number;
  embeddingSource: "ollama" | "skipped (offline)";
  ingestedAt: string;
}

// Resolver the store calls per issue to fold a real match_score into EV.
export type MatchResolver = (ctx: {
  language: string | null | undefined;
  title: string;
  body: string;
  labels: string[];
}) => MatchBreakdown | null;

let active: ActiveProfile | null = null;

/** Top-N most-frequent skill tokens across the user's repo descriptions. */
function deriveSkills(descriptions: string[], topN = 24): string[] {
  const freq = new Map<string, number>();
  for (const d of descriptions) {
    for (const t of tokenize(d)) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([t]) => t);
}

export function getActive(): ActiveProfile | null {
  return active;
}

export async function ingest(githubLogin: string): Promise<IngestResult> {
  const ingestedAt = new Date().toISOString();
  const res = await listUserRepos(githubLogin);
  if (res.source === "unreachable") {
    return {
      ok: false, login: res.login, source: "unreachable", reason: res.reason,
      repoCount: 0, languages: [], skills: [], chunkCount: 0,
      embeddingSource: "skipped (offline)", ingestedAt,
    };
  }

  const languages = [...new Set(res.repos.map((r) => r.language).filter((l): l is string => !!l))].map((l) => l.toLowerCase());
  const skills = deriveSkills(res.repos.map((r) => `${r.name} ${r.description ?? ""}`));

  // Chunk each repo; embed locally when Ollama answers, else leave embedding null.
  const chunks: UserChunk[] = [];
  let embedded = 0;
  for (const r of res.repos) {
    const content = `${r.name}. ${r.description ?? ""}`.trim();
    if (!content) continue;
    const v = await embed(content);
    if (v) embedded++;
    chunks.push({ source: `${res.login}/${r.name}`, content, embedding: v });
  }

  const profile: UserProfile = { login: res.login, skills, languages, source: "github", ingestedAt };
  active = { profile, chunks };

  return {
    ok: true, login: res.login, source: "github",
    repoCount: res.repos.length, languages, skills, chunkCount: chunks.length,
    embeddingSource: embedded > 0 ? "ollama" : "skipped (offline)", ingestedAt,
  };
}

/** Build a MatchResolver bound to the current active profile (null when none). */
export function matcher(): MatchResolver | null {
  if (!active) return null;
  const { profile, chunks } = active;
  return (ctx) =>
    computeMatch(
      { language: ctx.language, title: ctx.title, body: ctx.body, labels: ctx.labels },
      profile,
      null, // per-issue embeddings are produced in the worker path; board uses language+skills
      chunks,
    );
}
