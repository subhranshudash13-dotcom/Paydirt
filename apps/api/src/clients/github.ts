// Minimal GitHub client for the API's profile ingest (PRD §9). Reads ONLY public
// metadata (repo name/language/description). Real network call when reachable;
// an honest { source: "unreachable" } otherwise — never fabricates a profile.
import { config } from "../config.js";

export interface GhRepo {
  name: string;
  language: string | null;
  description: string | null;
  private: boolean;
}

export interface UserReposResult {
  login: string;
  source: "github" | "unreachable";
  repos: GhRepo[];
  reason?: string;
}

const API = "https://api.github.com";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    "user-agent": "paydirt",
    accept: "application/vnd.github+json",
  };
  if (config.githubToken) h.authorization = `Bearer ${config.githubToken}`;
  return h;
}

/** Fetch a user's public repos (most-recently-updated first). Public endpoint; works unauthenticated at low rate. */
export async function listUserRepos(login: string): Promise<UserReposResult> {
  const clean = login.trim().replace(/^@/, "");
  if (!clean) return { login, source: "unreachable", repos: [], reason: "empty login" };
  try {
    const res = await fetch(`${API}/users/${encodeURIComponent(clean)}/repos?per_page=100&sort=updated`, {
      headers: headers(),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { login: clean, source: "unreachable", repos: [], reason: `github ${res.status}` };
    }
    const data = (await res.json()) as Array<{
      name: string; language: string | null; description: string | null; private: boolean;
    }>;
    const repos: GhRepo[] = data
      .filter((r) => !r.private)
      .map((r) => ({ name: r.name, language: r.language, description: r.description, private: false }));
    return { login: clean, source: "github", repos };
  } catch (e) {
    return { login: clean, source: "unreachable", repos: [], reason: String(e) };
  }
}
