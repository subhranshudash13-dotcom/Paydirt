import { useEffect, useState } from "react";
import type { TrackedItem, TrackStatus } from "@paydirt/shared";
import { api } from "../api";
import { money } from "../format";

const STAGES: { key: TrackStatus; label: string }[] = [
  { key: "CLAIMED", label: "Claimed" },
  { key: "WORKING", label: "Working" },
  { key: "PR_OPEN", label: "PR Open" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "MERGED", label: "Merged" },
  { key: "PAID", label: "Paid Out" },
];

const STAGE_ORDER: Record<string, number> = {
  CLAIMED: 0,
  WORKING: 1,
  PR_OPEN: 2,
  IN_REVIEW: 3,
  MERGED: 4,
  PAYOUT_PENDING: 4,
  PAID: 5,
  ABANDONED: -1,
};

interface TrackerProps {
  onSelectIssue?: (id: number) => void;
}

export function Tracker({ onSelectIssue }: TrackerProps): JSX.Element {
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "MERGED" | "PAID" | "ABANDONED">("ALL");
  const [prPromptId, setPrPromptId] = useState<number | null>(null);
  const [prUrlInput, setPrUrlInput] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    try {
      setItems(await api.track());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const send = async (id: number, type: string, payload?: Record<string, unknown>): Promise<void> => {
    setBusyId(id);
    try {
      await api.signal(id, type, payload);
      await refresh();
    } catch (e) {
      alert(`Signal error: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handlePrSubmit = async (id: number): Promise<void> => {
    const url = prUrlInput.trim() || `https://github.com/pull/${id}`;
    await send(id, "prOpened", { url });
    setPrPromptId(null);
    setPrUrlInput("");
  };

  const totalValue = items.reduce((s, t) => s + (t.issue?.bountyAmount ?? 0), 0);
  const paidCount = items.filter((t) => t.status === "PAID").length;
  const mergedCount = items.filter((t) => t.status === "MERGED" || t.status === "PAYOUT_PENDING").length;
  const activeCount = items.filter((t) => t.status !== "PAID" && t.status !== "ABANDONED").length;

  const filteredItems = items.filter((t) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return t.status !== "PAID" && t.status !== "ABANDONED";
    if (filter === "MERGED") return t.status === "MERGED" || t.status === "PAYOUT_PENDING";
    if (filter === "PAID") return t.status === "PAID";
    if (filter === "ABANDONED") return t.status === "ABANDONED";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-3.5 bg-coal border-2 border-slate-700 shadow-brutal-sm">
          <div className="font-mono text-[10px] uppercase font-bold text-slate-400">TOTAL CLAIMS</div>
          <div className="font-mono text-2xl font-black text-white mt-1">{items.length}</div>
        </div>
        <div className="card p-3.5 bg-coal border-2 border-cyber-500 shadow-brutal-sm">
          <div className="font-mono text-[10px] uppercase font-bold text-slate-400">IN FLIGHT</div>
          <div className="font-mono text-2xl font-black text-cyber-300 mt-1">{activeCount}</div>
        </div>
        <div className="card p-3.5 bg-coal border-2 border-gold-500 shadow-brutal-sm">
          <div className="font-mono text-[10px] uppercase font-bold text-slate-400">MERGED & PENDING</div>
          <div className="font-mono text-2xl font-black text-gold-400 mt-1">{mergedCount}</div>
        </div>
        <div className="card p-3.5 bg-coal border-2 border-acid-500 shadow-brutal-sm">
          <div className="font-mono text-[10px] uppercase font-bold text-slate-400">PAID OUT</div>
          <div className="font-mono text-2xl font-black text-acid-400 mt-1">
            {paidCount} <span className="text-xs text-slate-400">({money(totalValue)})</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {(["ALL", "ACTIVE", "MERGED", "PAID", "ABANDONED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 font-bold uppercase transition-all ${
                filter === f
                  ? "border-2 border-black bg-gold-400 text-black shadow-brutal-sm"
                  : "border border-slate-700 bg-coal text-slate-300 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="btn-outline !py-1 text-xs"
        >
          {loading ? "REFRESHING…" : "↻ REFRESH WORKFLOWS"}
        </button>
      </div>

      {/* Empty State */}
      {!loading && filteredItems.length === 0 && (
        <div className="card p-12 text-center border-2 border-slate-700 bg-coal shadow-brutal">
          <div className="text-4xl">⛏️</div>
          <h3 className="mt-3 text-xl font-black uppercase text-white tracking-wide">
            NO BOUNTIES IN THIS VIEW
          </h3>
          <p className="mt-2 text-sm text-slate-300 max-w-md mx-auto font-sans leading-relaxed">
            Claims tracked here run <strong className="text-gold-400">durable Temporal workflows</strong> that
            survive process restarts across the entire PR and payout lifecycle.
          </p>
        </div>
      )}

      {/* Tracked Claims List */}
      <div className="space-y-4">
        {filteredItems.map((t) => {
          const currentStep = STAGE_ORDER[t.status] ?? 0;
          const isAbandoned = t.status === "ABANDONED";
          const isPaid = t.status === "PAID";
          const isMerged = t.status === "MERGED" || t.status === "PAYOUT_PENDING";

          return (
            <div
              key={t.id}
              className={`card p-5 border-2 ${
                isPaid
                  ? "border-acid-500 shadow-brutal-acid"
                  : isMerged
                  ? "border-gold-500 shadow-brutal-gold"
                  : isAbandoned
                  ? "border-slate-800 opacity-60"
                  : "border-slate-700 shadow-brutal"
              } bg-coal`}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-slate-800 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`chip border-2 !text-[11px] !py-0.5 ${
                        isPaid
                          ? "border-acid-500 bg-acid-400/20 text-acid-300"
                          : isMerged
                          ? "border-gold-500 bg-gold-400/20 text-gold-300"
                          : isAbandoned
                          ? "border-rose-500 bg-rose-500/20 text-rose-300"
                          : "border-cyber-500 bg-cyber-500/20 text-cyber-300"
                      }`}
                    >
                      ● {t.status}
                    </span>
                    {t.payoutStatus !== "none" && (
                      <span className="chip-acid !text-[10px] !py-0">
                        PAYOUT: {t.payoutStatus.toUpperCase()}
                      </span>
                    )}
                    <span className="font-mono text-xs text-slate-400">
                      ID #{t.id} · Workflow: <code className="text-slate-300">{t.workflowId}</code>
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">
                    {t.issue?.title ?? `Tracked Issue #${t.issueId}`}
                  </h3>

                  {t.issue?.url && (
                    <div className="mt-1 flex items-center gap-2 font-mono text-xs">
                      <a
                        href={t.issue.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyber-400 hover:underline"
                      >
                        {t.issue.url.replace("https://github.com/", "")} ↗
                      </a>
                      {onSelectIssue && (
                        <button
                          onClick={() => onSelectIssue(t.issueId)}
                          className="text-gold-400 hover:underline font-bold"
                        >
                          [Inspect Detail]
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  {t.issue?.bountyAmount && (
                    <div className="font-mono text-2xl font-black text-gold-400">
                      {money(t.issue.bountyAmount)}
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-slate-400 uppercase">
                    CLAIMED: {new Date(t.claimedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Progress Stepper */}
              {!isAbandoned ? (
                <div className="my-4 overflow-x-auto py-2">
                  <div className="flex items-center justify-between min-w-[500px]">
                    {STAGES.map((s, idx) => {
                      const completed = currentStep > idx;
                      const active = currentStep === idx;
                      return (
                        <div key={s.key} className="flex-1 flex items-center">
                          <div className="flex flex-col items-center">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded border-2 font-mono text-xs font-bold shadow-brutal-sm ${
                                active
                                  ? "border-black bg-gold-400 text-black scale-110"
                                  : completed
                                  ? "border-acid-500 bg-acid-400/20 text-acid-300"
                                  : "border-slate-700 bg-slate-900 text-slate-500"
                              }`}
                            >
                              {completed ? "✓" : idx + 1}
                            </div>
                            <span
                              className={`mt-1 font-mono text-[10px] uppercase font-bold tracking-wider ${
                                active
                                  ? "text-gold-400 font-black"
                                  : completed
                                  ? "text-slate-200"
                                  : "text-slate-500"
                              }`}
                            >
                              {s.label}
                            </span>
                          </div>
                          {idx < STAGES.length - 1 && (
                            <div
                              className={`h-1 flex-1 mx-2 rounded ${
                                completed ? "bg-acid-500" : "bg-slate-800"
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="my-3 rounded border border-rose-500/50 bg-rose-500/10 p-2 text-center font-mono text-xs text-rose-300">
                  ⚠️ This bounty claim was marked as ABANDONED.
                </div>
              )}

              {/* PR URL Badge if attached */}
              {t.prUrl && (
                <div className="mb-3 flex items-center gap-2 font-mono text-xs text-slate-300 rounded border border-slate-700 bg-black/40 p-2">
                  <span className="text-cyber-400 font-bold">PULL REQUEST:</span>
                  <a
                    href={t.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white hover:underline truncate"
                  >
                    {t.prUrl} ↗
                  </a>
                </div>
              )}

              {/* Inline PR Prompt Modal */}
              {prPromptId === t.id && (
                <div className="mb-3 card-accent-cyber p-3">
                  <div className="font-mono text-xs font-bold text-cyber-300 mb-2">
                    ENTER PR URL (OPTIONAL):
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={prUrlInput}
                      onChange={(e) => setPrUrlInput(e.target.value)}
                      placeholder={`https://github.com/pull/${t.id}`}
                      className="input-brutal flex-1 !py-1 text-xs"
                    />
                    <button
                      onClick={() => handlePrSubmit(t.id)}
                      className="btn-cyber !px-3 !py-1 text-xs"
                    >
                      Confirm PR
                    </button>
                    <button
                      onClick={() => setPrPromptId(null)}
                      className="btn-outline !py-1 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Signal Action Buttons */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setPrPromptId(t.id);
                      setPrUrlInput(t.prUrl || "");
                    }}
                    disabled={busyId === t.id || isPaid}
                    className="btn-outline !py-1 !px-2.5 text-xs hover:border-cyber-400 hover:text-cyber-300"
                  >
                    1. PR OPENED
                  </button>
                  <button
                    onClick={() => send(t.id, "maintainerComment")}
                    disabled={busyId === t.id || isPaid}
                    className="btn-outline !py-1 !px-2.5 text-xs hover:border-amber-400 hover:text-amber-300"
                  >
                    2. MAINTAINER REPLIED
                  </button>
                  <button
                    onClick={() => send(t.id, "markMerged")}
                    disabled={busyId === t.id || isPaid}
                    className="btn-outline !py-1 !px-2.5 text-xs hover:border-gold-400 hover:text-gold-300"
                  >
                    3. MARK MERGED
                  </button>
                  <button
                    onClick={() => send(t.id, "markPaid")}
                    disabled={busyId === t.id || isPaid}
                    className="btn-outline !py-1 !px-2.5 text-xs hover:border-acid-400 hover:text-acid-300"
                  >
                    4. MARK PAID
                  </button>
                </div>

                {!isAbandoned && !isPaid && (
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to abandon this claim?")) {
                        void send(t.id, "abandon");
                      }
                    }}
                    disabled={busyId === t.id}
                    className="font-mono text-xs text-rose-400 hover:underline"
                  >
                    Abandon Claim
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
