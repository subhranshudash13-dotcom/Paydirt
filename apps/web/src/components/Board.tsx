import { useEffect, useState } from "react";
import type { RankedIssue } from "@paydirt/shared";
import { api } from "../api";
import { money, pct, perHour, days, timeAgo } from "../format";

const SORTS = [
  { key: "ev", label: "EV / hour" },
  { key: "bounty", label: "Bounty" },
  { key: "p", label: "P(paid)" },
  { key: "match", label: "Match" },
  { key: "days", label: "Fastest" },
] as const;

function Bar({ v, tone }: { v: number; tone: string }): JSX.Element {
  return (
    <div className="h-1.5 w-16 rounded bg-white/10">
      <div className={`h-1.5 rounded ${tone}`} style={{ width: `${Math.max(4, Math.min(100, v * 100))}%` }} />
    </div>
  );
}

export function Board({ onSelect, search }: { onSelect: (id: number) => void; search: string }): JSX.Element {
  const [rows, setRows] = useState<RankedIssue[]>([]);
  const [sort, setSort] = useState<string>("ev");
  const [lang, setLang] = useState<string>("");
  const [minEv, setMinEv] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const langs = Array.from(new Set(rows.map((r) => r.repo.language).filter(Boolean))) as string[];

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const run = async (): Promise<void> => {
      try {
        const data = search.trim()
          ? await api.search(search.trim())
          : await api.issues({ sort, language: lang || undefined, minEv: minEv ? Number(minEv) : undefined, limit: 100 });
        if (alive) setRows(data);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [sort, lang, minEv, search]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-md px-3 py-1 text-sm transition ${sort === s.key && !search ? "bg-gold-500 text-black font-semibold" : "text-slate-300 hover:bg-white/5"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm">
          <option value="">All languages</option>
          {langs.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input value={minEv} onChange={(e) => setMinEv(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="min $/hr" className="w-28 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm" />
        {search && <span className="chip bg-gold-500/15 text-gold-400">searching “{search}”</span>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/30 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Issue</th>
              <th className="px-2 py-3">Repo</th>
              <th className="px-2 py-3">Bounty</th>
              <th className="px-2 py-3">P(paid)</th>
              <th className="px-2 py-3">Est. days</th>
              <th className="px-2 py-3">Match</th>
              <th className="px-4 py-3 text-right">EV / hr</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Sifting the ore…</td></tr>
            )}
            {error && !loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-rose-400">API error: {error}. Run <code>make dev-api</code>.</td></tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No issues match those filters.</td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.issue.id} onClick={() => onSelect(r.issue.id)} className="cursor-pointer border-t border-white/5 hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-100">{r.issue.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">#{r.issue.number} · {timeAgo(r.issue.createdAt)}
                    {r.issue.bountySource === "algora" && <span className="ml-2 chip bg-violet-500/15 text-violet-300">algora</span>}
                  </div>
                </td>
                <td className="px-2 py-3 text-slate-300">
                  <div>{r.repo.fullName}</div>
                  <div className="text-xs text-slate-500">{r.repo.language} · {r.repo.stars.toLocaleString()}★</div>
                </td>
                <td className="px-2 py-3 font-semibold text-emerald-300">{money(r.issue.bountyAmount)}</td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2"><Bar v={r.prediction.pSuccess} tone="bg-sky-400" /><span className="text-slate-300">{pct(r.prediction.pSuccess)}</span></div>
                </td>
                <td className="px-2 py-3 text-slate-300">{days(r.prediction.daysToMergeEst)}</td>
                <td className="px-2 py-3"><Bar v={r.prediction.matchScore ?? 0} tone="bg-fuchsia-400" /></td>
                <td className="px-4 py-3 text-right font-bold text-gold-400">{perHour(r.prediction.evPerHour)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">Sorted by {SORTS.find((s) => s.key === sort)?.label}. EV/hr = P(paid) × bounty ÷ est_hours × (0.5 + 0.5 × match).</p>
    </div>
  );
}
