import { useEffect, useState } from "react";
import type { HealthResponse } from "@paydirt/shared";
import { api } from "../api";

function Dot({ on, onText, offText }: { on: boolean; onText: string; offText: string }): JSX.Element {
  return (
    <span className={`chip ${on ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-400" : "bg-slate-500"}`} />
      {on ? onText : offText}
    </span>
  );
}

export function Privacy(): JSX.Element {
  const [h, setH] = useState<HealthResponse | null>(null);
  useEffect(() => { void api.health().then(setH).catch(() => setH(null)); }, []);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="text-lg font-semibold text-slate-100">Your code never leaves your machine</h3>
        <p className="mt-1 text-sm text-slate-400">Paydirt is built on open-weight models so the privacy boundary is real, not a promise.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Col title="Stays local" tone="text-emerald-300" items={["Your repo contents & code", "README / code embeddings", "Gemma chats & drafts (via Ollama)"]} />
          <Col title="Sent to TabPFN" tone="text-sky-300" items={["Anonymous numeric feature rows", "No code, no usernames", "Prior Labs — non-commercial key"]} />
          <Col title="Sent to GitHub / SerpApi" tone="text-amber-300" items={["Search queries", "Public API calls only", "Nothing posted without approval"]} />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200">Live service status</h4>
          {h && <span className="text-xs text-slate-500">data driver: <span className="text-gold-400">{h.db}</span></span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Dot on={!!h?.ollama} onText="Ollama (local Gemma) up" offText="Ollama down — run `make up`" />
          <Dot on={!!h?.predictor} onText="TabPFN sidecar up" offText="TabPFN sidecar down" />
          <Dot on={!!h?.temporal} onText="Temporal up" offText="Temporal down" />
          <Dot on={(h?.db ?? "") !== "down"} onText={`Postgres/Tiger Data: ${h?.db ?? "?"}`} offText="DB down" />
          <Dot on={!!h?.sentry} onText="Sentry error reporting on" offText="Sentry off (no DSN) — errors stay local" />
        </div>
      </div>

      <div className="card p-5">
        <h4 className="text-sm font-semibold text-slate-200">Human-in-the-loop</h4>
        <p className="mt-1 text-sm text-slate-400">
          <code className="rounded bg-black/30 px-1">DRY_RUN=true</code> by default. Paydirt <strong className="text-slate-200">drafts</strong> plans, PR
          descriptions, and follow-ups — it never posts to GitHub without your explicit approval. Autonomous submission is a non-goal.
        </p>
      </div>
    </div>
  );
}

function Col({ title, items, tone }: { title: string; items: string[]; tone: string }): JSX.Element {
  return (
    <div className="rounded-lg bg-black/20 p-3">
      <div className={`text-xs font-semibold uppercase tracking-wide ${tone}`}>{title}</div>
      <ul className="mt-2 space-y-1 text-sm text-slate-300">
        {items.map((i) => <li key={i} className="flex gap-2"><span className="text-slate-600">›</span>{i}</li>)}
      </ul>
    </div>
  );
}
