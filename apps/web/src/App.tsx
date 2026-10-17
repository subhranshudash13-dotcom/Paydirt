import { useEffect, useState } from "react";
import type { HealthResponse } from "@paydirt/shared";
import { api } from "./api";
import Landing from "./pages/Landing";
import { Board } from "./components/Board";
import { Detail } from "./components/Detail";
import { Tracker } from "./components/Tracker";
import { ModelPanel } from "./components/ModelPanel";
import { Privacy } from "./components/Privacy";
import { Profile } from "./components/Profile";

type Tab = "board" | "profile" | "tracker" | "model" | "privacy";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "board", label: "BOUNTY BOARD", icon: "📋" },
  { key: "profile", label: "SKILL PROFILE", icon: "👤" },
  { key: "tracker", label: "WORKFLOW TRACKER", icon: "⛓️" },
  { key: "model", label: "MODEL METRICS", icon: "🧠" },
  { key: "privacy", label: "LOCAL PRIVACY", icon: "🔒" },
];

export function App(): JSX.Element {
  const [view, setView] = useState<"landing" | "dashboard">("landing");
  const [tab, setTab] = useState<Tab>("board");
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const load = (): void => {
      void api.health().then(setHealth).catch(() => setHealth(null));
    };
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  if (view === "landing") {
    return <Landing onEnter={() => setView("dashboard")} />;
  }

  return (
    <div className="min-h-full bg-ore flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b-2 border-slate-800 bg-coal/95 backdrop-blur shadow-brutal-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Logo & Sub-tag */}
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2.5 text-left group transition-transform active:scale-95"
              onClick={() => setView("landing")}
              title="Return to Landing Page"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded border-2 border-black bg-gold-400 text-lg font-black shadow-brutal-sm group-hover:bg-gold-300">
                ⛏️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl font-black tracking-tight text-white group-hover:text-gold-400 transition-colors">
                    PAYDIRT
                  </span>
                  <span className="chip-gold !text-[10px] !py-0 !px-1.5">HACKTOBERFEST</span>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Open-Weight Bounty Agent
                </div>
              </div>
            </button>
          </div>

          {/* Brutalist Segmented Tabs */}
          <nav className="flex items-center gap-1.5 rounded-lg border-2 border-slate-800 bg-black/60 p-1 shadow-brutal-sm overflow-x-auto max-w-full">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-mono font-bold tracking-wider uppercase transition-all ${
                    active
                      ? "border-2 border-black bg-gold-400 text-black shadow-brutal-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent"
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Search + System Health */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value) setTab("board");
                }}
                placeholder="Search bounties…"
                className="input-brutal w-44 sm:w-56 !py-1 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <HealthBadge health={health} />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 flex-1 w-full">
        {tab === "board" && (
          <Board
            onSelect={setSelected}
            search={search}
            onGoToTracker={() => setTab("tracker")}
          />
        )}
        {tab === "profile" && <Profile onGoToBoard={() => setTab("board")} />}
        {tab === "tracker" && <Tracker onSelectIssue={setSelected} />}
        {tab === "model" && <ModelPanel />}
        {tab === "privacy" && <Privacy />}
      </main>

      {/* Brutalist Footer */}
      <footer className="border-t-2 border-slate-800 bg-coal py-4 text-center font-mono text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>⛏️ <strong>PAYDIRT</strong></span>
            <span>·</span>
            <span>MIT Licensed</span>
            <span>·</span>
            <span className="text-slate-300">Hacktoberfest 2026</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>TabPFN (Prior Labs)</span>
            <span>·</span>
            <span>Gemma Local</span>
            <span>·</span>
            <span>Tiger Data</span>
            <span>·</span>
            <span>Temporal</span>
            <span>·</span>
            <span>Sentry</span>
          </div>
        </div>
      </footer>

      {/* Issue Detail Drawer Modal */}
      {selected != null && (
        <Detail
          id={selected}
          onClose={() => setSelected(null)}
          onTrackSuccess={() => setTab("tracker")}
        />
      )}
    </div>
  );
}

function HealthBadge({ health }: { health: HealthResponse | null }): JSX.Element {
  const ds = health?.dataSource;
  const live = ds === "live-github" || ds === "postgres";
  const tone = !health
    ? "border-slate-700 bg-slate-900 text-slate-400"
    : live
    ? "border-acid-500/80 bg-acid-500/15 text-acid-300"
    : "border-gold-500/80 bg-gold-500/15 text-gold-300";

  const label = !health
    ? "OFFLINE"
    : ds === "live-github"
    ? "● LIVE GITHUB"
    : ds === "postgres"
    ? "● TIGER DATA"
    : "● SEED FEED";

  return (
    <span
      className={`chip border-2 ${tone}`}
      title={
        health
          ? `Feed: ${ds}\nModel: ${health.modelVersion}\nIssues: ${health.issueCount}\nOllama: ${health.ollama ? "online" : "offline"}\nTemporal: ${health.temporal ? "connected" : "offline"}\nTabPFN sidecar: ${health.predictor ? "online" : "heuristic"}\nSentry: ${health.sentry ? "enabled" : "disabled"}`
          : "API unreachable. Run make dev-api"
      }
    >
      <span className={health ? "live-dot !h-2 !w-2" : "h-2 w-2 rounded-full bg-slate-500"} />
      {label}
    </span>
  );
}

