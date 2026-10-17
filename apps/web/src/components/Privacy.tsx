import { useEffect, useState } from "react";
import type { HealthResponse } from "@paydirt/shared";
import { api } from "../api";

function StatusChip({
  on,
  name,
  onDesc,
  offDesc,
}: {
  on: boolean;
  name: string;
  onDesc: string;
  offDesc: string;
}): JSX.Element {
  return (
    <div
      className={`rounded border-2 p-3 font-mono text-xs shadow-brutal-sm flex items-start gap-3 transition-colors ${
        on
          ? "border-acid-500/80 bg-acid-400/10 text-slate-200"
          : "border-slate-800 bg-coal text-slate-400"
      }`}
    >
      <div
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded font-mono text-xs font-bold border ${
          on ? "border-acid-500 bg-acid-400 text-black" : "border-slate-700 bg-black text-slate-500"
        }`}
      >
        {on ? "✓" : "✕"}
      </div>
      <div>
        <div className="font-extrabold uppercase tracking-wide text-white flex items-center gap-2">
          <span>{name}</span>
          <span
            className={`chip !text-[9px] !py-0 ${
              on ? "border-acid-500 bg-acid-400/20 text-acid-300" : "border-slate-700 bg-black text-slate-400"
            }`}
          >
            {on ? "CONNECTED" : "OFFLINE / STANDALONE"}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-300 leading-snug">
          {on ? onDesc : offDesc}
        </div>
      </div>
    </div>
  );
}

export function Privacy(): JSX.Element {
  const [h, setH] = useState<HealthResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = (): void => {
    setRefreshing(true);
    void api
      .health()
      .then(setH)
      .catch(() => setH(null))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      {/* Privacy Manifesto Card */}
      <div className="card p-6 border-2 border-slate-700 bg-coal shadow-brutal">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded border-2 border-black bg-acid-400 text-xl font-black shadow-brutal-sm">
            🔒
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-white tracking-tight">
              LOCAL-FIRST ARCHITECTURE & PRIVACY SHIELD
            </h3>
            <p className="font-mono text-xs text-slate-400">
              Open-weight AI where your proprietary code never leaves your local hardware
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-300 font-sans leading-relaxed">
          Unlike proprietary SaaS copilots that stream your code to cloud LLMs, Paydirt is designed with strict cryptographic boundaries. Your private repository files and drafts run on open-weight models executed locally.
        </p>

        {/* 3 Boundary Columns */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Col
            title="STAYS 100% LOCAL"
            tone="border-acid-500 bg-acid-400/10 text-acid-300"
            items={[
              "Your private repository contents & AST",
              "README & code embeddings (Gemma via Ollama)",
              "Plan & PR draft generation",
              "Local developer environment variables",
            ]}
          />
          <Col
            title="SENT TO TABPFN"
            tone="border-cyber-500 bg-cyber-400/10 text-cyber-300"
            items={[
              "Anonymous numeric & categorical feature vectors",
              "Zero code, zero filenames, zero usernames",
              "Prior Labs non-commercial research key",
              "Cached prediction inference",
            ]}
          />
          <Col
            title="SENT TO GITHUB / SERPAPI"
            tone="border-gold-500 bg-gold-400/10 text-gold-300"
            items={[
              "Public issue & repo search queries",
              "Read-only public API metadata calls",
              "Nothing ever auto-posted to GitHub",
              "Explicit human confirmation required",
            ]}
          />
        </div>
      </div>

      {/* Live Services Diagnostic Matrix */}
      <div className="card p-6 border-2 border-slate-700 bg-coal shadow-brutal">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-800 pb-4 mb-4">
          <div>
            <h4 className="font-mono text-sm font-black uppercase text-white tracking-wider">
              TELEMETRY & RUNTIME HEALTH MATRIX
            </h4>
            <div className="font-mono text-xs text-slate-400 mt-0.5">
              Current Active Data Driver: <span className="text-gold-400 font-bold">{h?.db ?? "memory"}</span>
            </div>
          </div>

          <button
            onClick={load}
            disabled={refreshing}
            className="btn-outline !py-1 text-xs"
          >
            {refreshing ? "PINGING SERVICES…" : "↻ PING SERVICES"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatusChip
            on={!!h?.ollama}
            name="Ollama (Local Gemma)"
            onDesc="Local inference active (gemma3:4b + embeddinggemma). Privacy boundary fully active."
            offDesc="Ollama unreachable on port 11434. Operating with deterministic template fallbacks."
          />
          <StatusChip
            on={!!h?.predictor}
            name="TabPFN Predictor Sidecar"
            onDesc="FastAPI Python sidecar live on port 8000 serving TabPFN foundation model predictions."
            offDesc="Sidecar offline. API is serving honest heuristic-v1 baseline predictions."
          />
          <StatusChip
            on={!!h?.temporal}
            name="Temporal Orchestrator"
            onDesc="Temporal server reachable at localhost:7233. Durable event-sourced workflows active."
            offDesc="Temporal offline. Workflows run in local state machine emulation."
          />
          <StatusChip
            on={(h?.db ?? "") !== "down"}
            name="Tiger Data (Timescale Postgres)"
            onDesc={`Postgres hypertable and pgvector storage connected (${h?.db ?? "memory"}).`}
            offDesc="Postgres unavailable. Memory driver active with realistic seed datasets."
          />
          <StatusChip
            on={!!h?.sentry}
            name="Sentry Error Tracing"
            onDesc="SENTRY_DSN configured. Error reports and traces routed to Sentry project."
            offDesc="SENTRY_DSN not set. Error reporting is an honest local no-op (zero tracking leaks)."
          />
        </div>
      </div>

      {/* Human-in-the-Loop Safeguard */}
      <div className="card p-5 border-2 border-gold-500/80 bg-coal shadow-brutal-gold">
        <div className="flex items-center gap-2 mb-2 font-mono text-xs font-black uppercase text-gold-400">
          <span>⚠️</span>
          <span>HUMAN-IN-THE-LOOP SAFEGUARD (DRY_RUN = TRUE)</span>
        </div>
        <p className="text-sm text-slate-300 font-sans leading-relaxed">
          Paydirt acts as an <strong className="text-white">advisor and drafter</strong>, never an autonomous bot. It prepares plans, PR bodies, and review responses for you to inspect, revise, and approve. Autonomous submission to open-source maintainers is strictly a non-goal.
        </p>
      </div>
    </div>
  );
}

function Col({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: string;
}): JSX.Element {
  return (
    <div className={`rounded border-2 p-4 font-mono shadow-brutal-sm bg-black/50 ${tone}`}>
      <div className="text-xs font-black uppercase tracking-wider mb-3">{title}</div>
      <ul className="space-y-2 text-xs text-slate-300 font-sans">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="font-mono text-gold-400 font-bold">›</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
