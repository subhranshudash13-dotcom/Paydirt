import { useEffect, useState, type ReactNode } from "react";
import type { RankedIssue, FeatureRow } from "@paydirt/shared";
import { api } from "../api";
import { money, pct, perHour, days } from "../format";

function FeatureBars({ f }: { f: Partial<FeatureRow> }): JSX.Element {
  const rows: [string, number][] = [
    ["Maintainer Merge Rate (90d)", f.maintainerMergeRatePrior90d ?? 0.5],
    ["P(paid) Within 30d", (f as { pSuccess?: number }).pSuccess ?? 0.5],
    ["Repo Activity (30d Commits)", Math.min(1, (f.repoCommitsPrior30d ?? 0) / 300)],
    [
      "Maintainer Response Latency",
      Math.max(0, 1 - Math.min(1, (f.maintainerMedianFirstResponseHoursPrior90d ?? 24) / 72)),
    ],
    ["Developer Skill Match", (f as { matchScore?: number }).matchScore ?? 0.5],
  ];

  return (
    <div className="space-y-2.5">
      {rows.map(([label, v]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between font-mono text-xs text-slate-300">
            <span>{label}</span>
            <span className="font-bold text-white">{Math.round(v * 100)}%</span>
          </div>
          <div className="h-2.5 rounded border border-slate-700 bg-black/60 overflow-hidden shadow-brutal-sm">
            <div
              className="h-full bg-gradient-to-r from-gold-500 to-gold-300"
              style={{ width: `${Math.round(v * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface DetailProps {
  id: number;
  onClose: () => void;
  onTrackSuccess?: () => void;
}

export function Detail({ id, onClose, onTrackSuccess }: DetailProps): JSX.Element {
  const [row, setRow] = useState<RankedIssue | null>(null);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftModel, setDraftModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setRow(null);
    void api
      .issue(id)
      .then((r) => alive && setRow(r))
      .catch(() => alive && setRow(null));
    return () => {
      alive = false;
    };
  }, [id]);

  const track = async (): Promise<void> => {
    setBusy(true);
    try {
      const t = await api.createTrack(id);
      setTrackMsg(`Durable workflow ${t.workflowId ?? `bounty-lifecycle-${id}`} created in state ${t.status}.`);
    } catch (e) {
      setTrackMsg(`Tracking failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const draftPlan = async (): Promise<void> => {
    setBusy(true);
    try {
      const d = await api.draftPlan(id);
      setDraft(d.text);
      setDraftModel(d.model);
    } catch (e) {
      setDraft(`Drafting failed: ${(e as Error).message}. No code was posted.`);
      setDraftModel("error");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyDraft = (): void => {
    if (!draft) return;
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (!row) {
    return (
      <Panel onClose={onClose} title="BOUNTY INSPECTION">
        <div className="py-20 text-center font-mono text-slate-400">
          <span className="inline-block animate-spin mr-2">⛏️</span>
          LOADING BOUNTY DOSSIER #{id}…
        </div>
      </Panel>
    );
  }

  const f = {
    ...(row.prediction.features ?? {}),
    pSuccess: row.prediction.pSuccess,
    matchScore: row.prediction.matchScore,
  } as Partial<FeatureRow>;

  return (
    <Panel onClose={onClose} title={`ISSUE DOSSIER · #${row.issue.number}`}>
      {/* Header Info */}
      <div className="card p-5 mb-4 border-2 border-slate-700 bg-coal shadow-brutal">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 font-mono text-xs">
              <span className="chip-gold !text-[10px] !py-0 !px-1.5">
                {row.repo.language || "CODE"}
              </span>
              <a
                className="font-bold text-cyber-300 hover:text-white underline"
                href={row.issue.url}
                target="_blank"
                rel="noreferrer"
              >
                {row.repo.fullName}#{row.issue.number} ↗
              </a>
              <span className="text-slate-500">★ {row.repo.stars.toLocaleString()}</span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">{row.issue.title}</h2>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="font-mono text-2xl sm:text-3xl font-black text-gold-400">
              {perHour(row.prediction.evPerHour)}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              EXPECTED VALUE / HR
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        <Stat
          label="Bounty Reward"
          value={money(row.issue.bountyAmount)}
          tone="text-acid-400"
          accent="border-acid-500/80"
        />
        <Stat
          label="P(Paid ≤30d)"
          value={pct(row.prediction.pSuccess)}
          tone="text-cyber-300"
          accent="border-cyber-500/80"
        />
        <Stat
          label="Est. Merge"
          value={days(row.prediction.daysToMergeEst)}
          tone="text-slate-200"
          accent="border-slate-700"
        />
        <Stat
          label="Est. Effort"
          value={`${row.prediction.estHours ?? 10} hrs`}
          tone="text-gold-300"
          accent="border-gold-500/80"
        />
      </div>

      {/* Labels */}
      <div className="card p-3 mb-4 bg-coal/70">
        <div className="font-mono text-[10px] uppercase font-bold text-slate-400 mb-2">
          LABELS DETECTED
        </div>
        <div className="flex flex-wrap gap-1.5">
          {row.issue.labels.map((l) => (
            <span
              key={l}
              className="chip !text-[11px] !py-0.5 border-slate-700 bg-black/60 text-slate-200"
            >
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Issue Description Terminal Box */}
      {row.issue.body && (
        <div className="card p-4 mb-4 bg-black/70 border-2 border-slate-800">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
            <span className="font-mono text-[10px] uppercase font-bold text-slate-400">
              ISSUE SPECIFICATION (EXCERPT)
            </span>
            <a
              href={row.issue.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-cyber-400 hover:underline"
            >
              Open on GitHub ↗
            </a>
          </div>
          <p className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {row.issue.body}
          </p>
        </div>
      )}

      {/* Feature Breakdown: Why this score */}
      <div className="card p-4 mb-5 border-2 border-slate-700 bg-coal shadow-brutal-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs font-black uppercase text-white tracking-wider">
            PREDICTOR SIGNAL DECOMPOSITION
          </h3>
          <span className="chip-cyber !text-[10px] !py-0">
            {row.prediction.modelVersion}
          </span>
        </div>
        <FeatureBars f={f} />
        <p className="mt-3 font-mono text-[10px] text-slate-400 border-t border-slate-800 pt-2">
          🔒 Only anonymous numeric feature rows evaluated. Private source code never leaves your local machine.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <button
          onClick={track}
          disabled={busy}
          className="btn-gold !py-3 text-xs"
        >
          {busy ? "COMMITTING…" : "TRACK THIS BOUNTY →"}
        </button>
        <button
          onClick={draftPlan}
          disabled={busy}
          className="btn-ghost !py-3 text-xs"
        >
          {busy ? "GENERATING…" : "⚡ DRAFT PLAN (LOCAL GEMMA)"}
        </button>
      </div>

      {/* Tracking Confirmation Message */}
      {trackMsg && (
        <div className="card-accent-acid p-3.5 mb-4 font-mono text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base">✅</span>
            <span className="text-acid-200 font-bold">{trackMsg}</span>
          </div>
          {onTrackSuccess && (
            <button
              onClick={() => {
                onTrackSuccess();
                onClose();
              }}
              className="btn-acid !px-2.5 !py-1 text-[11px]"
            >
              Go to Tracker →
            </button>
          )}
        </div>
      )}

      {/* AI Plan Draft Box */}
      {draft && (
        <div className="card p-4 border-2 border-gold-500/80 bg-coal shadow-brutal-gold mb-4">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="chip-gold !text-[10px] !py-0">AI DRAFT PLAN</span>
              <span className="text-slate-400">· DRY-RUN (NEVER AUTO-POSTED)</span>
            </div>
            <div className="flex items-center gap-2">
              {draftModel && (
                <span className="chip !text-[10px] !py-0 border-slate-700 bg-black/60 text-slate-300">
                  {draftModel}
                </span>
              )}
              <button
                onClick={handleCopyDraft}
                className="btn-outline !py-0.5 !px-2 text-[10px]"
              >
                {copied ? "COPIED! ✓" : "COPY PLAN"}
              </button>
            </div>
          </div>
          <div className="font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto bg-black/40 p-3 rounded border border-slate-800">
            {draft}
          </div>
          <div className="mt-2 font-mono text-[10px] text-slate-400">
            Human-in-the-loop: Review, edit, or copy into your local editor or PR description.
          </div>
        </div>
      )}
    </Panel>
  );
}

function Stat({
  label,
  value,
  tone,
  accent,
}: {
  label: string;
  value: string;
  tone: string;
  accent: string;
}): JSX.Element {
  return (
    <div className={`card p-3 bg-coal border-2 ${accent} shadow-brutal-sm`}>
      <div className={`font-mono text-xl font-black ${tone}`}>{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
        {label}
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-2xl overflow-y-auto border-l-4 border-slate-800 bg-seam p-6 shadow-brutal-xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b-2 border-slate-800 pb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-black tracking-wider uppercase text-gold-400">
            <span>⛏️</span>
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded border-2 border-slate-700 bg-coal font-mono text-sm font-bold text-slate-300 shadow-brutal-sm hover:border-white hover:text-white transition"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
