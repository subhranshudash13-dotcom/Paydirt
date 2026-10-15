import { useEffect, useState, type ReactNode } from "react";
import type { RankedIssue, FeatureRow } from "@paydirt/shared";
import { api } from "../api";
import { money, pct, perHour, days } from "../format";

function FeatureBars({ f }: { f: Partial<FeatureRow> }): JSX.Element {
  const rows: [string, number][] = [
    ["Maintainer merge rate (90d)", f.maintainerMergeRatePrior90d ?? 0],
    ["P(paid) within 30d", (f as { pSuccess?: number }).pSuccess ?? 0],
    ["Repo activity (30d commits)", Math.min(1, (f.repoCommitsPrior30d ?? 0) / 300)],
    ["Fast maintainer response", Math.max(0, 1 - Math.min(1, (f.maintainerMedianFirstResponseHoursPrior90d ?? 0) / 72))],
    ["Skill match", (f as { matchScore?: number }).matchScore ?? 0],
  ];
  return (
    <div className="space-y-2">
      {rows.map(([label, v]) => (
        <div key={label}>
          <div className="mb-0.5 flex justify-between text-xs text-slate-400"><span>{label}</span><span>{Math.round(v * 100)}%</span></div>
          <div className="h-2 rounded bg-white/10"><div className="h-2 rounded bg-gradient-to-r from-gold-600 to-gold-400" style={{ width: `${Math.round(v * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Detail({ id, onClose }: { id: number; onClose: () => void }): JSX.Element {
  const [row, setRow] = useState<RankedIssue | null>(null);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setRow(null);
    void api.issue(id).then((r) => alive && setRow(r)).catch(() => alive && setRow(null));
    return () => { alive = false; };
  }, [id]);

  const track = async (): Promise<void> => {
    setBusy(true);
    try {
      const t = await api.createTrack(id);
      setTrackMsg(`Tracking started — Temporal workflow ${t.workflowId ?? "(queued)"} in state ${t.status}.`);
    } catch (e) {
      setTrackMsg(`Track failed: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  const draftPlan = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await fetch("/api/drafts/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ issueId: id }) });
      const j = await res.json();
      setDraft(res.ok ? j.text : "Local Gemma drafting needs Ollama running (`make up && make models`). Nothing is ever posted without your approval.");
    } catch {
      setDraft("Drafting needs Ollama. Nothing is ever posted without your approval.");
    } finally { setBusy(false); }
  };

  if (!row) return <Panel onClose={onClose} title="Loading…"><div className="py-10 text-center text-slate-400">Loading issue…</div></Panel>;

  const f = { ...(row.prediction.features ?? {}), pSuccess: row.prediction.pSuccess, matchScore: row.prediction.matchScore } as Partial<FeatureRow>;

  return (
    <Panel onClose={onClose} title="Issue detail">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{row.issue.title}</h2>
          <a className="text-sm text-sky-400 hover:underline" href={row.issue.url} target="_blank" rel="noreferrer">{row.repo.fullName}#{row.issue.number} ↗</a>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gold-400">{perHour(row.prediction.evPerHour)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-500">expected value / hr</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Bounty" value={money(row.issue.bountyAmount)} tone="text-emerald-300" />
        <Stat label="P(paid ≤30d)" value={pct(row.prediction.pSuccess)} tone="text-sky-300" />
        <Stat label="Est. to merge" value={days(row.prediction.daysToMergeEst)} tone="text-slate-200" />
        <Stat label="Est. hours" value={String(row.prediction.estHours ?? "—")} tone="text-slate-200" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {row.issue.labels.map((l) => <span key={l} className="chip bg-white/5 text-slate-300">{l}</span>)}
      </div>

      {row.issue.body && <p className="mt-4 rounded-lg bg-black/20 p-3 text-sm text-slate-300">{row.issue.body}</p>}

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Why this score</h3>
        <div className="card p-3"><FeatureBars f={f} /></div>
        <p className="mt-1 text-xs text-slate-500">Model: <span className="text-slate-300">{row.prediction.modelVersion}</span>. Only anonymous numeric features are used — no code leaves your machine.</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button onClick={track} disabled={busy} className="rounded-lg bg-gold-500 px-4 py-2 font-semibold text-black transition hover:bg-gold-400 disabled:opacity-50">
          Track this bounty →
        </button>
        <button onClick={draftPlan} disabled={busy} className="rounded-lg border border-white/15 px-4 py-2 font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-50">
          Draft plan (local Gemma)
        </button>
      </div>
      {trackMsg && <p className="mt-2 rounded-lg bg-sky-500/10 p-2 text-sm text-sky-200">{trackMsg}</p>}
      {draft && (
        <div className="mt-3 rounded-lg border border-dashed border-white/15 bg-black/20 p-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Draft · dry run · not posted</div>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{draft}</p>
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }): JSX.Element {
  return (
    <div className="card p-3">
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

export function Panel({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-seam p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-500">{title}</span>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-400 hover:bg-white/10">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
