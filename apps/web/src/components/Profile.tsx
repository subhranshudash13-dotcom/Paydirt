import { useEffect, useState } from "react";
import { api, type ProfileState, type IngestResult } from "../api";

// Profile ingest (PRD §9, Loop 7). Visibility-first: the moment a login is ingested
// we show the REAL derived skills/languages as prominent chips and an honest banner
// for how embeddings were produced (ollama vs skipped-offline). Nothing is fabricated.

export function Profile({ onGoToBoard }: { onGoToBoard: () => void }): JSX.Element {
  const [login, setLogin] = useState("");
  const [state, setState] = useState<ProfileState | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.profile().then(setState).catch(() => setState(null));
  }, []);

  const submit = async (): Promise<void> => {
    const handle = login.trim();
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
      <div className="card p-5">
        <h3 className="text-lg font-semibold text-slate-100">Connect your skills</h3>
        <p className="mt-1 text-sm text-slate-400">
          Paydirt reads your <strong className="text-slate-200">public</strong> repos, derives skill + language signals, and re-ranks the board
          by how well each bounty fits <em>you</em>. Repo contents never leave your machine; embeddings run locally via Gemma/Ollama when it is up.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-white/10 bg-black/20 focus-within:border-gold-500">
            <span className="px-3 text-sm text-slate-500">github.com/</span>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              placeholder="your-login"
              className="w-48 bg-transparent px-1 py-2 text-sm outline-none"
            />
          </div>
          <button
            onClick={() => void submit()}
            disabled={busy || !login.trim()}
            className="rounded-lg bg-gold-500 px-4 py-2 font-semibold text-black transition hover:bg-gold-400 disabled:opacity-50"
          >
            {busy ? "Ingesting…" : "Ingest profile"}
          </button>
          {active && (
            <button onClick={onGoToBoard} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5">
              View ranked board →
            </button>
          )}
        </div>
        {!active && !error && (
          <p className="mt-2 text-xs text-slate-500">Try a real login you know, e.g. <code className="rounded bg-black/30 px-1">gaearon</code>.</p>
        )}
        {error && <p className="mt-3 rounded-lg bg-rose-500/10 p-2 text-sm text-rose-300">{error}</p>}
      </div>

      {active && (
        <>
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-200">
                Active profile · <span className="text-gold-400">{shownLogin}</span>
              </h4>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="chip bg-emerald-500/15 text-emerald-300">source: github</span>
                {typeof repoCount === "number" && <span className="chip bg-white/5 text-slate-300">{repoCount} repos read</span>}
                <span className="chip bg-white/5 text-slate-300">board is skill-aware</span>
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Languages</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {languages.length ? languages.map((l) => (
                <span key={l} className="rounded-md bg-sky-500/15 px-2 py-1 text-sm font-medium text-sky-200">{l}</span>
              )) : <span className="text-sm text-slate-500">none detected</span>}
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Derived skills</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {skills.length ? skills.map((s) => (
                <span key={s} className="rounded-md bg-fuchsia-500/15 px-2 py-1 text-sm font-medium text-fuchsia-200">{s}</span>
              )) : <span className="text-sm text-slate-500">none detected</span>}
            </div>

            {embeddingSource && (
              <div className={`mt-4 rounded-lg p-3 text-sm ${embeddingSource === "ollama" ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>
                {embeddingSource === "ollama"
                  ? "Semantic embeddings generated locally with EmbeddingGemma (Ollama) — match uses cosine + skills + language."
                  : "Ollama offline → embeddings skipped. Match uses skill overlap + language only (still real, ranked, and clearly labelled)."}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h4 className="text-sm font-semibold text-slate-200">How this changes your board</h4>
            <p className="mt-1 text-sm text-slate-400">
              Every issue now carries a skill <span className="text-fuchsia-300">match</span> in its score:
              <code className="ml-1 rounded bg-black/30 px-1">EV/hr = P(paid) × bounty ÷ est_hours × (0.5 + 0.5 × match)</code>.
              Sort the board by <strong className="text-slate-200">Match</strong> to see your best-fit bounties first.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
