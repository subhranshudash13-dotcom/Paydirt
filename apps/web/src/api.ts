import type { RankedIssue, TrackedItem, ModelMetrics, HealthResponse } from "@paydirt/shared";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return (await res.json()) as T;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
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
};
