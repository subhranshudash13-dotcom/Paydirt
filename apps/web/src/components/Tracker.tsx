import { useEffect, useState } from "react";
import type { TrackedItem } from "@paydirt/shared";
import { api } from "../api";
import { STATUS_COLORS } from "../format";

const FLOW: { type: string; label: string }[] = [
  { type: "prOpened", label: "PR opened" },
  { type: "maintainerComment", label: "Maintainer replied" },
  { type: "markMerged", label: "Merged" },
  { type: "markPaid", label: "Paid" },
  { type: "abandon", label: "Abandon" },
];

export function Tracker(): JSX.Element {
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    try { setItems(await api.track()); } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const send = async (id: number, type: string): Promise<void> => {
    const payload = type === "prOpened" ? { url: `https://github.com/example/pr/${id}` } : undefined;
    await api.signal(id, type, payload);
    await refresh();
  };

  if (!loading && items.length === 0) {
    return (
      <div className="card p-10 text-center">
        <div className="text-3xl">⛏️</div>
        <h3 className="mt-2 text-lg font-semibold text-slate-200">No bounties tracked yet</h3>
        <p className="mt-1 text-sm text-slate-400">Open an issue on the Board and hit <span className="text-gold-400">Track this bounty</span>. Each claim runs a durable Temporal workflow that survives worker restarts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((t) => (
        <div key={t.id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium text-slate-100">{t.issue?.title ?? `Issue #${t.issueId}`}</div>
              <div className="text-xs text-slate-500">{t.issue ? `${t.issue.url.replace("https://github.com/", "")} · ` : ""}workflow {t.workflowId}</div>
            </div>
            <span className={`chip ${STATUS_COLORS[t.status] ?? "bg-white/10"}`}>{t.status}</span>
          </div>

          <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-500">
            {["CLAIMED", "WORKING", "PR_OPEN", "IN_REVIEW", "MERGED", "PAID"].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <span className={t.status === s ? "text-gold-400" : ""}>{s}</span>
                {i < 5 && <span>›</span>}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {FLOW.map((f) => (
              <button key={f.type} onClick={() => void send(t.id, f.type)} className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5">
                {f.label}
              </button>
            ))}
          </div>
          {t.payoutStatus !== "none" && <p className="mt-2 text-xs text-emerald-300">payout: {t.payoutStatus}</p>}
        </div>
      ))}
    </div>
  );
}
