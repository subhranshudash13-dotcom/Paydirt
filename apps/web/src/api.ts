import type { RankedIssue, TrackedItem, ModelMetrics, HealthResponse, Draft } from "@paydirt/shared";

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

export interface ProfileState {
  active: boolean;
  login?: string;
  skills?: string[];
  languages?: string[];
  source?: "github" | "unreachable";
  ingestedAt?: string;
  chunkCount?: number;
  embeddedChunks?: number;
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

async function getJSON<T>(url: string): Promise<T> {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${fullUrl}`);
  return (await res.json()) as T;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${fullUrl}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => getJSON<HealthResponse>("/api/health"),
  issues: (params: { sort?: string; language?: string; minEv?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.sort) qs.set("sort", params.sort);
    if (params.language) qs.set("language", params.language);
    if (params.minEv != null) qs.set("minEv", String(params.minEv));
    if (params.limit) qs.set("limit", String(params.limit));
    return getJSON<RankedIssue[]>(`/api/issues?${qs.toString()}`);
  },
  issue: (id: number) => getJSON<RankedIssue>(`/api/issues/${id}`),
  search: (q: string) => getJSON<RankedIssue[]>(`/api/search?q=${encodeURIComponent(q)}`),
  model: () => getJSON<ModelMetrics>("/api/model"),
  track: () => getJSON<TrackedItem[]>("/api/track"),
  createTrack: (issueId: number) => postJSON<TrackedItem>("/api/track", { issueId }),
  signal: (id: number, type: string, payload?: Record<string, unknown>) =>
    postJSON<TrackedItem>(`/api/track/${id}/signal`, { type, payload }),
  profile: () => getJSON<ProfileState>("/api/profile"),
  ingest: (githubLogin: string) => postJSON<IngestResult>("/api/profile/ingest", { githubLogin }),
  draftPlan: (issueId: number) => postJSON<Draft>("/api/drafts/plan", { issueId }),
  refresh: () => postJSON<{ source: string; modelVersion: string; count: number }>("/api/refresh", {}),
};
