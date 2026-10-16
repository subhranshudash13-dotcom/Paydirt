import { useEffect, useState } from "react";
import type { HealthResponse } from "@paydirt/shared";
import { api } from "./api";
import { Board } from "./components/Board";
import { Detail } from "./components/Detail";
import { Tracker } from "./components/Tracker";
import { ModelPanel } from "./components/ModelPanel";
import { Privacy } from "./components/Privacy";
import { Profile } from "./components/Profile";

type Tab = "board" | "profile" | "tracker" | "model" | "privacy";

const TABS: { key: Tab; label: string }[] = [
  { key: "board", label: "Board" },
  { key: "profile", label: "Profile" },
  { key: "tracker", label: "Tracker" },
  { key: "model", label: "Model" },
  { key: "privacy", label: "Privacy" },
];

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("board");
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const load = (): void => { void api.health().then(setHealth).catch(() => setHealth(null)); };
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ore/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-3">
          <button className="flex items-center gap-2" onClick={() => setTab("board")}>
            <span className="text-xl">⛏️</span>
            <span className="text-lg font-black tracking-tight text-slate-100">Paydirt</span>
            <span className="hidden text-xs text-slate-500 sm:inline">turn open source into paydirt</span>
          </button>

          <nav className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-1 text-sm transition ${tab === t.key ? "bg-white/10 font-semibold text-slate-100" : "text-slate-400 hover:text-slate-200"}`}>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (e.target.value) setTab("board"); }}
              placeholder="Search bounties…"
              className="w-40 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm outline-none focus:border-gold-500"
            />
            <HealthBadge health={health} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {tab === "board" && <Board onSelect={setSelected} search={search} />}
        {tab === "profile" && <Profile onGoToBoard={() => setTab("board")} />}
        {tab === "tracker" && <Tracker />}
        {tab === "model" && <ModelPanel />}
        {tab === "privacy" && <Privacy />}
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-8 pt-4 text-center text-xs text-slate-600">
        Paydirt · built for DEV × Hacktoberfest 2026 — open-weight AI that belongs to everyone ·
        <span className="text-slate-500"> Gemma · TabPFN · Tiger Data · Temporal · Sentry</span>
      </footer>

      {selected != null && <Detail id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function HealthBadge({ health }: { health: HealthResponse | null }): JSX.Element {
  const tone = !health ? "bg-slate-500/20 text-slate-400" : health.db === "postgres" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300";
  const label = !health ? "offline" : health.db === "postgres" ? "live data" : "demo seed";
  return (
    <span className={`chip ${tone}`} title={health ? `db=${health.db} ollama=${health.ollama} temporal=${health.temporal} tabpfn=${health.predictor} sentry=${health.sentry}` : "API unreachable"}>
      {label}
    </span>
  );
}
