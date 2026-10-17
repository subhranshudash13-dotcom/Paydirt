import { useEffect, useState } from "react";
import { api, type ProfileState, type IngestResult } from "../api";

const PRESETS = ["torvalds", "antfu", "gaearon", "yyx990803", "sindresorhus"];

export function Profile({ onGoToBoard }: { onGoToBoard: () => void }): JSX.Element {
  const [login, setLogin] = useState("");
  const [state, setState] = useState<ProfileState | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.profile().then(setState).catch(() => setState(null));
  }, []);

  const submit = async (overrideLogin?: string): Promise<void> => {
    const handle = (overrideLogin ?? login).trim();
    if (!handle) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.ingest(handle);
      setResult(r);
      const s = await api.profile();
      setState(s);
      if (!r.ok) setError(r.reason ?? "GitHub was unreachable — no profile was fabricated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const active = state?.active && result?.ok !== false;
  const skills = result?.ok ? result.skills : state?.skills ?? [];
  const languages = result?.ok ? result.languages : state?.languages ?? [];
  const shownLogin = result?.ok ? result.login : state?.login;
  const repoCount = result?.ok ? result.repoCount : undefined;
  const embeddingSource = result?.ok ? result.embeddingSource : undefined;

  return (
    <div className="space-y-4">
      {/* Connect Profile Card */}
      <div className="card p-6 border-2 border-slate-700 bg-coal shadow-brutal">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded border-2 border-black bg-gold-400 text-lg shadow-brutal-sm">
            👤
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-white tracking-tight">
              CONNECT DEVELOPER SKILLS
            </h3>
            <p className="font-mono text-xs text-slate-400">
              Personalize EV/Hour rankings to your engineering background
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-300 font-sans leading-relaxed">
          Paydirt reads your <strong className="text-white">public repositories</strong>, derives skill + language vectors, and re-ranks the board by calculating match score. Private code never leaves your local machine; embeddings execute locally with <strong className="text-acid-400">EmbeddingGemma on Ollama</strong>.
        </p>

        {/* Preset Shortcuts */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase font-bold text-slate-400">
            TRY PRESET HANDLES:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setLogin(p);
                void submit(p);
              }}
              disabled={busy}
              className="chip !text-[10px] !py-0.5 border-slate-700 bg-black/60 text-slate-300 hover:border-gold-400 hover:text-white transition"
            >
              @{p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded border-2 border-slate-700 bg-black/80 shadow-brutal-sm focus-within:border-gold-400">
            <span className="px-3 font-mono text-xs text-slate-500">github.com/</span>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder="your-github-username"
              className="w-52 bg-transparent py-2 font-mono text-sm text-white outline-none"
            />
          </div>

          <button
            onClick={() => void submit()}
            disabled={busy || !login.trim()}
            className="btn-gold !py-2 !px-5 text-xs"
          >
            {busy ? "INGESTING REPOS…" : "INGEST PROFILE →"}
          </button>

          {active && (
            <button
              onClick={onGoToBoard}
              className="btn-ghost !py-2 !px-5 text-xs"
            >
              VIEW RE-RANKED BOARD →
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 card-accent-acid p-3 font-mono text-xs text-rose-300 border-rose-500">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Active Profile Dossier */}
      {active && (
        <>
          <div className="card p-6 border-2 border-gold-500/80 bg-coal shadow-brutal-gold">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded border-2 border-black bg-gold-400 font-mono text-xl font-black shadow-brutal-sm">
                  {shownLogin ? shownLogin[0].toUpperCase() : "G"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-black text-white">
                      @{shownLogin}
                    </span>
                    <span className="chip-gold !text-[10px] !py-0">ACTIVE PROFILE</span>
                  </div>
                  <div className="font-mono text-xs text-slate-400">
                    Source: Public GitHub API · Board is actively skill-weighted
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-mono">
                {typeof repoCount === "number" && (
                  <span className="chip border-slate-700 bg-black/60 text-slate-200">
                    {repoCount} REPOS ANALYZED
                  </span>
                )}
                <span className="chip-acid !text-[10px]">
                  RE-RANKING ACTIVE
                </span>
              </div>
            </div>

            {/* Derived Languages */}
            <div className="mt-5">
              <span className="font-mono text-xs font-black uppercase tracking-wider text-slate-400">
                DETECTED PRIMARY LANGUAGES
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {languages.length ? (
                  languages.map((l) => (
                    <span
                      key={l}
                      className="rounded border-2 border-cyber-500/80 bg-cyber-500/15 px-3 py-1 font-mono text-xs font-extrabold uppercase text-cyber-200 shadow-brutal-sm"
                    >
                      {l}
                    </span>
                  ))
                ) : (
                  <span className="font-mono text-xs text-slate-500">None detected</span>
                )}
              </div>
            </div>

            {/* Derived Skills */}
            <div className="mt-5">
              <span className="font-mono text-xs font-black uppercase tracking-wider text-slate-400">
                DERIVED SKILL CLUSTERS
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skills.length ? (
                  skills.map((s) => (
                    <span
                      key={s}
                      className="rounded border border-hotpink-500/80 bg-hotpink-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-hotpink-200 shadow-brutal-sm"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="font-mono text-xs text-slate-500">None detected</span>
                )}
              </div>
            </div>

            {/* Embedding status */}
            {embeddingSource && (
              <div
                className={`mt-5 rounded border-2 p-3 font-mono text-xs shadow-brutal-sm ${
                  embeddingSource === "ollama"
                    ? "border-acid-500 bg-acid-400/10 text-acid-300"
                    : "border-gold-500 bg-gold-400/10 text-gold-300"
                }`}
              >
                {embeddingSource === "ollama" ? (
                  <div className="flex items-center gap-2">
                    <span>🧠</span>
                    <span>
                      Vector embeddings calculated locally with <strong>EmbeddingGemma (Ollama)</strong>. Cosine similarity + skill overlap actively re-rank the board.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>⚡</span>
                    <span>
                      Ollama offline → Semantic embeddings bypassed. Match score computed via <strong>honest token overlap + language match</strong> (fully functional and verifiable).
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formula Callout */}
          <div className="card p-5 border-2 border-slate-700 bg-coal shadow-brutal">
            <h4 className="font-mono text-xs font-black uppercase text-gold-400 tracking-wider">
              HOW MATCH SCORE CHANGES YOUR BOUNTY BOARD
            </h4>
            <p className="mt-2 text-sm text-slate-300 font-sans leading-relaxed">
              Every issue now multiplies by your personal fit:
              <br />
              <code className="mt-2 inline-block rounded border border-slate-700 bg-black/80 px-2 py-1 font-mono text-xs text-gold-300">
                EV/hr = P(success) × bounty ÷ est_hours × (0.5 + 0.5 × match_score)
              </code>
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={onGoToBoard} className="btn-gold !py-2 !px-4 text-xs">
                Go to Board and Sort by "Skill Match" →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
