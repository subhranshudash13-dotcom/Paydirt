import { useEffect, useState } from "react";
import type { ModelMetrics } from "@paydirt/shared";
import { api } from "../api";

function AUC({ label, value, hi }: { label: string; value: number; hi?: boolean }): JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
      <span className={hi ? "text-gold-400 font-semibold" : "text-slate-300"}>{label}</span>
      <span className={hi ? "text-gold-400 font-bold" : "text-slate-400"}>{value > 0 ? value.toFixed(3) : "—"}</span>
    </div>
  );
}

export function ModelPanel(): JSX.Element {
  const [m, setM] = useState<ModelMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void api.model().then(setM).catch((e) => setErr((e as Error).message)); }, []);

  if (err) return <div className="card p-6 text-rose-300">Model metrics unavailable: {err}</div>;
  if (!m) return <div className="card p-6 text-slate-400">Loading model metrics…</div>;

  const tabpfnLive = m.classifier.rocAuc > 0;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Model: <span className="text-gold-400">{m.version}</span></h3>
            <p className="text-xs text-slate-500">trained {new Date(m.trainedAt).toLocaleString()} · {m.rows} rows · positive rate {(m.positiveRate * 100).toFixed(0)}%</p>
          </div>
          <span className={`chip ${tabpfnLive ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
            {tabpfnLive ? "TabPFN live" : "heuristic baseline — run the sidecar for TabPFN"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-200">Discrimination (ROC-AUC)</h4>
          <div className="space-y-1.5">
            <AUC label="TabPFN (success)" value={m.classifier.rocAuc} hi />
            <AUC label="Gradient-boosted trees" value={m.baselines.gradientBoostedTrees} />
            <AUC label="Logistic regression" value={m.baselines.logisticRegression} />
            <AUC label="Bounty-size-only ranking" value={m.baselines.bountyOnly} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Higher = better at separating issues that actually pay from those that don't. Reported honestly — TabPFN does not always win.</p>
        </div>

        <div className="card p-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-200">“Hours saved” simulation</h4>
          <p className="text-xs text-slate-500">Replay the test period: expected EV/hour when you follow the model's top-N vs. following raw bounty size.</p>
          <div className="mt-3 space-y-3">
            <Metric label="Model EV / hour" value={`$${m.hoursSavedSim.modelEvPerHour.toFixed(2)}`} tone="text-gold-400" />
            <Metric label="Bounty-only EV / hour" value={`$${m.hoursSavedSim.bountyOnlyEvPerHour.toFixed(2)}`} tone="text-slate-300" />
            <Metric label="Uplift" value={`${m.hoursSavedSim.deltaPct >= 0 ? "+" : ""}${m.hoursSavedSim.deltaPct.toFixed(1)}%`} tone={m.hoursSavedSim.deltaPct >= 0 ? "text-emerald-300" : "text-rose-300"} />
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">PR-AUC: {m.classifier.prAuc > 0 ? m.classifier.prAuc.toFixed(3) : "—"} · Calibration (ECE): {m.classifier.calibrationEce != null ? m.classifier.calibrationEce.toFixed(3) : "—"}. Full backtest + plots live in docs/DATA_REPORT.md.</p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }): JSX.Element {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
