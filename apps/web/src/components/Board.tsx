import { useEffect, useState } from "react";
import type { RankedIssue } from "@paydirt/shared";
import { api } from "../api";
import { money, perHour, days, timeAgo } from "../format";

const SORTS = [
  { key: "ev", label: "EV / HOUR", icon: "💰" },
  { key: "bounty", label: "BOUNTY $", icon: "💎" },
  { key: "p", label: "P(PAID)", icon: "📈" },
  { key: "match", label: "SKILL MATCH", icon: "🎯" },
  { key: "days", label: "FASTEST MERGE", icon: "⚡" },
] as const;

function BrutalMeter({ v, tone }: { v: number; tone: string }): JSX.Element {
  const percentage = Math.max(4, Math.min(100, Math.round(v * 100)));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded border border-slate-700 bg-black/60 overflow-hidden shadow-brutal-sm">
        <div className={`h-full ${tone}`} style={{ width: `${percentage}%` }} />
      </div>
      <span className="font-mono text-xs font-bold text-slate-300">{percentage}%</span>
    </div>
  );
}

interface BoardProps {
  onSelect: (id: number) => void;
  search: string;
  onGoToTracker?: () => void;
}

export function Board({ onSelect, search, onGoToTracker }: BoardProps): JSX.Element {
  const [rows, setRows] = useState<RankedIssue[]>([]);
  const [sort, setSort] = useState<string>("ev");
  const [lang, setLang] = useState<string>("");
  const [minEv, setMinEv] = useState<string>("");
  const [gfiOnly, setGfiOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<{ source: string; modelVersion: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [trackAlert, setTrackAlert] = useState<{ id: number; title: string } | null>(null);

  const langs = Array.from(new Set(rows.map((r) => r.repo.language).filter(Boolean))) as string[];
  const totalBounty = rows.reduce((s, r) => s + (r.issue.bountyAmount ?? 0), 0);
  const avgEv = rows.length ? rows.reduce((s, r) => s + (r.prediction.evPerHour ?? 0), 0) / rows.length : 0;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const run = async (): Promise<void> => {
      try {
        const data = search.trim()
          ? await api.search(search.trim())
          : await api.issues({
              sort,
              language: lang || undefined,
              minEv: minEv ? Number(minEv) : undefined,
              limit: 100,
            });
        const h = await api.health().catch(() => null);
        if (alive) {
          setRows(data);
          if (h) setFeed({ source: h.dataSource, modelVersion: h.modelVersion });
        }
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
  }, [sort, lang, minEv, search, nonce]);

  const refreshLive = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await api.refresh();
      setNonce((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleQuickTrack = async (e: React.MouseEvent, issueId: number, title: string): Promise<void> => {
    e.stopPropagation();
    try {
      await api.createTrack(issueId);
      setTrackAlert({ id: issueId, title });
      setTimeout(() => setTrackAlert(null), 6000);
    } catch (err) {
      alert(`Track error: ${(err as Error).message}`);
    }
  };

  const displayedRows = gfiOnly ? rows.filter((r) => r.issue.hasGoodFirstIssue) : rows;

  return (
    <div className="space-y-4">
      {/* Track Alert Toast */}
      {trackAlert && (
        <div className="card-accent-gold p-4 flex items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-xl">⛏️</span>
            <div>
              <span className="font-black text-white">TRACKING ACTIVATED: </span>
              <span className="text-gold-300 font-bold">{trackAlert.title}</span>
              <span className="text-slate-400"> (Durable Temporal workflow launched)</span>
            </div>
          </div>
          {onGoToTracker && (
            <button onClick={onGoToTracker} className="btn-gold !px-3 !py-1 text-[11px]">
              Go to Tracker →
            </button>
          )}
        </div>
      )}

      {/* Telemetry & Summary Bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <div className="rounded border-2 border-slate-700 bg-coal px-3 py-1 font-bold shadow-brutal-sm">
              <span className="text-slate-400">BOUNTIES: </span>
              <span className="font-extrabold text-white">{rows.length}</span>
            </div>
            <div className="rounded border-2 border-gold-600 bg-gold-400/10 px-3 py-1 font-bold text-gold-300 shadow-brutal-sm">
              <span className="text-slate-400">VALUE: </span>
              <span className="font-extrabold">{money(totalBounty)}</span>
            </div>
            <div className="rounded border-2 border-acid-600 bg-acid-400/10 px-3 py-1 font-bold text-acid-300 shadow-brutal-sm">
              <span className="text-slate-400">AVG EV/HR: </span>
              <span className="font-extrabold">{perHour(avgEv)}</span>
            </div>
            {feed && <SourceChip source={feed.source} />}
            {feed && (
              <span className="chip-cyber !py-1" title="Model serving predictions">
                MODEL: {feed.modelVersion}
              </span>
            )}
          </div>

          <button
            onClick={refreshLive}
            disabled={refreshing}
            className="btn-outline flex items-center gap-2"
          >
            <span className={refreshing ? "animate-spin" : ""}>↻</span>
            <span>{refreshing ? "PULLING GITHUB…" : "REFRESH LIVE FEED"}</span>
          </button>
        </div>
      </div>

      {/* Controls & Filter Toolbar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Sort Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 rounded border-2 border-slate-800 bg-black/60 p-1 shadow-brutal-sm">
            <span className="px-2 font-mono text-[11px] font-extrabold uppercase text-slate-400">
              SORT:
            </span>
            {SORTS.map((s) => {
              const active = sort === s.key && !search;
              return (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-mono font-bold uppercase transition-all ${
                    active
                      ? "border-2 border-black bg-gold-400 text-black shadow-brutal-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="input-brutal !py-1 text-xs uppercase"
            >
              <option value="">ALL LANGUAGES</option>
              {langs.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>

            <input
              value={minEv}
              onChange={(e) => setMinEv(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="MIN $/HR"
              className="input-brutal w-28 !py-1 text-xs uppercase"
            />

            <label className="flex items-center gap-2 rounded border-2 border-slate-700 bg-coal px-2.5 py-1 text-xs font-mono font-bold text-slate-300 shadow-brutal-sm cursor-pointer hover:border-slate-500">
              <input
                type="checkbox"
                checked={gfiOnly}
                onChange={(e) => setGfiOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-gold-400"
              />
              <span>GOOD FIRST ISSUE</span>
            </label>

            {search && (
              <span className="chip-gold">
                FILTER: "{search}"
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-sm">
            <thead className="border-b-2 border-slate-800 bg-coal font-mono text-xs font-extrabold uppercase tracking-wider text-slate-300">
              <tr>
                <th className="px-4 py-3.5">ISSUE DETAILS</th>
                <th className="px-3 py-3.5">REPO</th>
                <th className="px-3 py-3.5">BOUNTY</th>
                <th className="px-3 py-3.5">P(PAID)</th>
                <th className="px-3 py-3.5">EST. TIME</th>
                <th className="px-3 py-3.5">MATCH</th>
                <th className="px-4 py-3.5 text-right">EV / HR</th>
                <th className="px-4 py-3.5 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-800/80 bg-seam">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center font-mono text-slate-400">
                    <span className="inline-block animate-bounce mr-2">⛏️</span>
                    SIFTING THE ORE FOR PAYDIRT…
                  </td>
                </tr>
              )}

              {error && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center font-mono text-rose-400">
                    ⚠️ API ERROR: {error}. Check terminal or verify backend.
                  </td>
                </tr>
              )}

              {!loading && !error && displayedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center font-mono text-slate-400">
                    No bounties matched the specified criteria. Try clearing filters.
                  </td>
                </tr>
              )}

              {!loading &&
                displayedRows.map((r) => {
                  const isHighEv = (r.prediction.evPerHour ?? 0) >= 30;
                  return (
                    <tr
                      key={r.issue.id}
                      onClick={() => onSelect(r.issue.id)}
                      className="cursor-pointer transition-colors hover:bg-slate-800/60 group"
                    >
                      <td className="px-4 py-3.5 max-w-md">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white group-hover:text-gold-400 transition-colors line-clamp-1">
                            {r.issue.title}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
                          <span className="text-slate-300">#{r.issue.number}</span>
                          <span>·</span>
                          <span>{timeAgo(r.issue.createdAt)}</span>
                          {r.issue.hasGoodFirstIssue && (
                            <span className="chip !text-[10px] !py-0 border-acid-600 bg-acid-400/10 text-acid-300">
                              good first issue
                            </span>
                          )}
                          {r.issue.bountySource === "algora" && (
                            <span className="chip !text-[10px] !py-0 border-hotpink-600 bg-hotpink-400/10 text-hotpink-300">
                              algora
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="font-mono text-xs font-bold text-slate-200">
                          {r.repo.fullName}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-400 flex items-center gap-1.5">
                          <span className="chip !text-[9px] !py-0 !px-1.5 border-slate-700 bg-coal text-slate-300">
                            {r.repo.language || "code"}
                          </span>
                          <span>★ {r.repo.stars.toLocaleString()}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 font-mono">
                        <span className="chip-gold !text-xs !py-0.5">
                          {money(r.issue.bountyAmount)}
                        </span>
                      </td>

                      <td className="px-3 py-3.5">
                        <BrutalMeter v={r.prediction.pSuccess} tone="bg-cyber-400" />
                      </td>

                      <td className="px-3 py-3.5 font-mono text-xs text-slate-300">
                        <div>{days(r.prediction.daysToMergeEst)}</div>
                        <div className="text-[10px] text-slate-500">
                          ~{r.prediction.estHours ?? "—"} hrs work
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <BrutalMeter
                          v={r.prediction.matchScore ?? 0.5}
                          tone="bg-hotpink-400"
                        />
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono">
                        <div
                          className={`text-base font-black ${
                            isHighEv ? "text-acid-400" : "text-gold-400"
                          }`}
                        >
                          {perHour(r.prediction.evPerHour)}
                        </div>
                        <div className="text-[10px] uppercase text-slate-500">
                          {isHighEv ? "HIGH YIELD" : "EST. VALUE"}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => handleQuickTrack(e, r.issue.id, r.issue.title)}
                            className="btn-outline !py-1 !px-2 text-[10px]"
                            title="Track this bounty in Temporal lifecycle"
                          >
                            + TRACK
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-3 font-mono text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <span>
          Ranking Formula:{" "}
          <code className="text-gold-300">
            EV/hr = P(paid) × bounty ÷ est_hours × (0.5 + 0.5 × match)
          </code>
        </span>
        <span className="text-slate-500">
          Showing {displayedRows.length} of {rows.length} issues
        </span>
      </div>
    </div>
  );
}

function SourceChip({ source }: { source: string }): JSX.Element {
  const map: Record<string, { tone: string; label: string }> = {
    "live-github": { tone: "chip-acid", label: "FEED: LIVE GITHUB" },
    postgres: { tone: "chip-acid", label: "FEED: TIGER DATA" },
    seed: { tone: "chip-gold", label: "FEED: DEMO SEED" },
  };
  const s = map[source] ?? { tone: "chip", label: source.toUpperCase() };
  return <span className={s.tone}>{s.label}</span>;
}
