import type { HealthResponse } from "@paydirt/shared";

interface FooterProps {
  health?: HealthResponse | null;
  onNavigateTab?: (tab: "board" | "profile" | "tracker" | "model" | "privacy") => void;
  onGoToLanding?: () => void;
  activeTab?: string;
}

const TABS: { key: "board" | "profile" | "tracker" | "model" | "privacy"; label: string; icon: string }[] = [
  { key: "board", label: "BOUNTY BOARD", icon: "📋" },
  { key: "profile", label: "SKILL PROFILE", icon: "👤" },
  { key: "tracker", label: "WORKFLOW TRACKER", icon: "⛓️" },
  { key: "model", label: "MODEL METRICS", icon: "🧠" },
  { key: "privacy", label: "LOCAL PRIVACY", icon: "🔒" },
];

export function Footer({
  health,
  onNavigateTab,
  onGoToLanding,
  activeTab,
}: FooterProps): JSX.Element {
  return (
    <footer className="mt-auto border-t-2 border-slate-800 bg-coal/95 pt-10 pb-8 text-slate-300 font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800">
          {/* Column 1: Branding & Mission */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded border-2 border-black bg-gold-400 text-sm font-black shadow-brutal-xs">
                ⛏️
              </div>
              <span className="font-mono text-lg font-black tracking-tight text-white">PAYDIRT</span>
              <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                v0.1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Open-weight AI bounty discovery, TabPFN payout probability prediction, and Temporal durable tracking for open-source developers.
            </p>
            <div className="pt-1 flex items-center gap-2 font-mono text-xs">
              <span className="live-dot !h-2 !w-2" />
              <span className="text-slate-400">ENGINE:</span>
              <span className="text-gold-400 font-bold">{health?.modelVersion ?? "heuristic-v1"}</span>
              <span className="text-slate-600">·</span>
              <span className="text-acid-400 font-bold">{health?.dataSource ?? "seed"}</span>
            </div>
          </div>

          {/* Column 2: Quick Navigation */}
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Platform Navigation
            </div>
            <ul className="space-y-2 font-mono text-xs">
              {TABS.map((t) => (
                <li key={t.key}>
                  {onNavigateTab ? (
                    <button
                      onClick={() => onNavigateTab(t.key)}
                      className={`hover:text-gold-400 transition-colors flex items-center gap-2 ${
                        activeTab === t.key ? "text-gold-400 font-bold" : "text-slate-400"
                      }`}
                    >
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ) : (
                    <span className="flex items-center gap-2 text-slate-400">
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </span>
                  )}
                </li>
              ))}
              {onGoToLanding && (
                <li className="pt-1">
                  <button
                    onClick={onGoToLanding}
                    className="text-slate-500 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <span>🏠</span>
                    <span>Landing Page</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Column 3: Stack & Architecture */}
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Core Architecture
            </div>
            <ul className="space-y-1.5 text-xs text-slate-400 font-sans">
              <li>
                <span className="font-mono text-slate-300 font-bold">TabPFN</span> · Prior Labs Bayesian Predictor
              </li>
              <li>
                <span className="font-mono text-slate-300 font-bold">Gemma 3</span> · Local Offline Profile Embeddings
              </li>
              <li>
                <span className="font-mono text-slate-300 font-bold">Tiger Data</span> · TimescaleDB + pgvector
              </li>
              <li>
                <span className="font-mono text-slate-300 font-bold">Temporal</span> · Durable State Workflow Engine
              </li>
              <li>
                <span className="font-mono text-slate-300 font-bold">Sentry</span> · Distributed Tracing & Telemetry
              </li>
            </ul>
          </div>

          {/* Column 4: Trust & Transparency */}
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Privacy & Open Source
            </div>
            <div className="space-y-2.5 text-xs text-slate-400 font-sans">
              <p>
                <strong className="text-slate-200">Zero Cloud Leak:</strong> Profile embeddings and code analysis execute 100% locally on your machine via Ollama.
              </p>
              <p>
                <strong className="text-slate-200">Dry-Run Default:</strong> Nothing is ever submitted or written to GitHub without explicit confirmation.
              </p>
              <div className="pt-2">
                <a
                  href="https://github.com/subhranshudash13-dotcom/Paydirt"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-white hover:border-gold-400 hover:text-gold-400 transition-colors"
                >
                  <span>🐙</span>
                  <span>View GitHub Repo ↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>© 2026 Paydirt. Open source under MIT License.</span>
            <span>·</span>
            <span>DEV Community × Hacktoberfest 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="hover:text-gold-400 transition-colors"
            >
              ↑ Back to top
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
