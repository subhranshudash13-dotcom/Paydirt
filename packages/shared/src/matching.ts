// Skill-match primitives (PRD §9). Pure + deterministic so they are unit-testable
// and usable by both the API (board re-ranking) and the worker (activities).
// No network, no zod — the HTTP/Ollama wiring lives in the callers.
//
// match_score in [0,1] blends three signals, renormalized over whichever are
// available so the product still ranks honestly when embeddings are skipped
// (Ollama offline): embedding cosine, skill overlap, and language match.

export interface UserProfile {
  login: string;
  /** Lower-cased skill/topic tokens derived from the user's repos/READMEs. */
  skills: string[];
  /** Lower-cased primary languages across the user's repos. */
  languages: string[];
  /** Where the profile data came from — never silently fabricate. */
  source: "github" | "unreachable";
  ingestedAt: string;
}

export interface UserChunk {
  source: string;
  content: string;
  /** 768-dim EmbeddingGemma vector, or null when Ollama was offline. */
  embedding: number[] | null;
}

export interface MatchBreakdown {
  /** Language match: 1 if the issue repo language is in the user's set. */
  language: number;
  /** Token overlap between the issue text and the user's skills. [0,1] */
  skills: number;
  /** Cosine similarity vs the best user chunk, or null if no embeddings. */
  embedding: number | null;
  /** Weighted blend over the available signals. [0,1] */
  score: number;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Cosine similarity of two equal-ish length numeric vectors; 0 on degenerate input. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return clamp01(dot / (Math.sqrt(na) * Math.sqrt(nb)));
}

/** Lower-case word tokens, dropping short noise and non-words. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9+#.]{3,}/g) ?? []).filter(
    (w) => !STOP.has(w),
  );
}

const STOP = new Set([
  "the", "and", "for", "with", "this", "that", "from", "into", "your", "our",
  "have", "has", "add", "support", "when", "they", "them", "then", "than",
  "should", "would", "could", "about", "which", "there", "these", "those",
]);

/**
 * Fraction of the user's skill tokens that appear in the issue text, weighted by
 * how distinct the issue is. Returns 0 when either side is empty.
 */
export function skillOverlap(issueText: string, skills: readonly string[]): number {
  if (skills.length === 0) return 0;
  const issue = new Set(tokenize(issueText));
  if (issue.size === 0) return 0;
  const uniqSkills = new Set(skills.map((s) => s.toLowerCase()));
  let hits = 0;
  for (const s of uniqSkills) if (issue.has(s)) hits++;
  return clamp01(hits / Math.max(1, Math.min(8, uniqSkills.size)));
}

/** Language match: 1 when the issue's repo language is one the user works in. */
export function languageMatch(language: string | null | undefined, userLanguages: readonly string[]): number {
  if (!language || userLanguages.length === 0) return 0;
  const l = language.toLowerCase();
  return userLanguages.some((u) => u.toLowerCase() === l) ? 1 : 0.15;
}

export interface MatchParts {
  language: number;
  skills: number;
  embedding: number | null;
}

/**
 * Weighted blend, renormalized over the signals actually present.
 * Full weights when an embedding exists: 0.5 embedding, 0.3 skills, 0.2 language.
 * Offline (embedding null): 0.65 skills, 0.35 language.
 */
export function combineMatch(parts: MatchParts): number {
  if (parts.embedding != null) {
    return clamp01(0.5 * parts.embedding + 0.3 * parts.skills + 0.2 * parts.language);
  }
  return clamp01(0.65 * parts.skills + 0.35 * parts.language);
}

/** Best embedding cosine between the issue vector and any user chunk. */
export function bestEmbeddingCosine(issueEmbedding: readonly number[] | null, chunks: readonly UserChunk[]): number | null {
  if (!issueEmbedding || issueEmbedding.length === 0) return null;
  let best: number | null = null;
  for (const c of chunks) {
    if (!c.embedding || c.embedding.length === 0) continue;
    const s = cosineSimilarity(issueEmbedding, c.embedding);
    if (best === null || s > best) best = s;
  }
  return best;
}

/** Full match computation from issue signals + a profile. profile=null → null (caller uses neutral). */
export function computeMatch(
  issue: { language: string | null | undefined; title: string; body: string; labels: readonly string[] },
  profile: UserProfile | null,
  issueEmbedding: readonly number[] | null = null,
  chunks: readonly UserChunk[] = [],
): MatchBreakdown | null {
  if (!profile) return null;
  const language = languageMatch(issue.language, profile.languages);
  const skills = skillOverlap(`${issue.title} ${issue.body} ${issue.labels.join(" ")}`, profile.skills);
  const embedding = bestEmbeddingCosine(issueEmbedding, chunks);
  return { language, skills, embedding, score: combineMatch({ language, skills, embedding }) };
}
