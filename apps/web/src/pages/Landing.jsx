import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

// ── tiny formatters (plain JS, no deps) ───────────────────────────────
const usd = (n) =>
  n == null || !isFinite(n)
    ? "—"
    : n >= 1000
      ? "$" + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k"
      : "$" + Math.round(n).toLocaleString("en-US");

const num = (n) => (n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US"));

const STEPS = [
  { icon: "🔎", title: "Discover", body: "Scan live GitHub for issues that actually pay — bounty labels, Algora tiers, dollar figures in the body.", tag: "GoDaddy" },
  { icon: "🧠", title: "Predict", body: "TabPFN scores the odds each bounty actually pays out, and how long to merge — from anonymous features only.", tag: "TabPFN" },
  { icon: "🎯", title: "Match", body: "Your skills are embedded locally with Gemma on Ollama. No code, no username ever leaves your machine.", tag: "Gemma" },
  { icon: "💰", title: "Rank", body: "Everything is ordered by expected value per hour, so you chase the work that pays best for your time.", tag: "Tiger Data" },
  { icon: "⛓️", title: "Track", body: "Temporal durably follows each claim through PR → review → merge → payout, surviving restarts.", tag: "Temporal" },
];

const SPONSORS = ["Tiger Data", "MongoDB", "Render", "Sentry", "Temporal", "Prior Labs", "Gemma", "DigitalOcean", "GoDaddy"];

export default function Landing({ onEnter }) {
  const [health, setHealth] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [h, issues] = await Promise.all([api.health(), api.issues({ sort: "ev", limit: 100 })]);
        if (!alive) return;
        setHealth(h);
        setRows(issues);
        setStatus("ready");
      } catch {
        if (alive) setStatus("down");
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + (r.issue?.bountyAmount ?? 0), 0);
    const topEv = rows.reduce((m, r) => Math.max(m, r.prediction?.evPerHour ?? 0), 0);
    const langs = new Set(rows.map((r) => r.repo?.language).filter(Boolean));
    return { count: rows.length, total, topEv, langs: langs.size };
  }, [rows]);

  const sourceLabel =
    health?.dataSource === "live-github" ? "live GitHub" :
    health?.dataSource === "postgres" ? "Tiger Data (Postgres)" :
    "demo seed";

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />

      {/* top nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⛏️</span>
          <span className="text-xl font-black tracking-tight text-slate-50">Paydirt</span>
        </div>
        <button onClick={onEnter} className="btn-ghost !px-4 !py-2 text-xs">
          Skip to dashboard →
        </button>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-10 pb-16 text-center sm:pt-16">
        <div className="fade-up mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-300">
          <span className="live-dot" />
          {status === "ready" ? (
            <>
              <span className="font-semibold text-emerald-300">{num(stats.count)}</span> live bounties ·{" "}
              <span className="font-semibold text-gold-400">{usd(stats.total)}</span> on the table · model{" "}
              <span className="font-semibold text-slate-100">{health?.modelVersion ?? "…"}</span>
            </>
          ) : status === "down" ? (
            <>open-source AI agent for bountied GitHub issues</>
          ) : (
            <>connecting to the ore…</>
          )}
        </div>

        <h1 className="fade-up delay-1 mx-auto max-w-3xl text-5xl font-black leading-[1.05] tracking-tight text-slate-50 sm:text-6xl">
          Turn open source into <span className="shimmer-text">paydirt</span>.
        </h1>
        <p className="fade-up delay-2 mx-auto mt-5 max-w-2xl text-lg text-slate-400">
          Paydirt is an open-weight AI agent that finds bountied GitHub issues, predicts which ones
          actually pay, matches them to <em>your</em> skills <strong className="text-slate-200">locally</strong>,
          and ranks everything by expected value per hour — then tracks each claim to payout.
        </p>

        <div className="fade-up delay-3 mt-8 flex flex-wrap items-center justify-center gap-3">
          <button onClick={onEnter} className="btn-gold text-base">
            Enter the dashboard →
          </button>
          <a href="#how" className="btn-ghost text-base">
            How it works
          </a>
        </div>

        {/* live stat cards */}
        <div className="fade-up delay-4 mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Open bounties" value={num(stats.count)} sub="live from GitHub" />
          <StatCard label="Bounty value" value={usd(stats.total)} sub="summed live" accent />
          <StatCard label="Top EV / hour" value={usd(stats.topEv)} sub="model-ranked" />
          <StatCard label="Languages" value={num(stats.langs)} sub="in current feed" />
        </div>

        <p className="fade-up delay-5 mt-5 text-xs text-slate-500">
          Feed source: <span className="text-slate-300">{sourceLabel}</span> · predictions served by{" "}
          <span className="text-slate-300">{health?.modelVersion ?? "heuristic-v1"}</span>
          {health?.predictor ? " · sidecar online" : " · sidecar offline"}
        </p>
      </section>

      {/* how it works */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-black tracking-tight text-slate-50">The core loop</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-slate-400">
          Five stages, every one of them real and inspectable in the dashboard.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card floaty p-5" style={{ animationDelay: `${i * 0.4}s` }}>
              <div className="text-3xl">{s.icon}</div>
              <div className="mt-3 font-bold text-slate-100">{s.title}</div>
              <div className="mt-1 text-sm leading-snug text-slate-400">{s.body}</div>
              <div className="mt-3 text-[10px] uppercase tracking-wide text-gold-500">{s.tag}</div>
            </div>
          ))}
        </div>
      </section>

      {/* privacy callout */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-10">
        <div className="card p-8 text-center sm:p-10">
          <div className="text-4xl">🔒</div>
          <h3 className="mt-3 text-2xl font-black text-slate-50">Your code never leaves your machine.</h3>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Skill embeddings and PR drafts run on <strong className="text-slate-200">local Gemma / Ollama</strong>.
            Only anonymous numeric features go to the TabPFN sidecar — never your source, repo names, or identity.
            Nothing is ever posted to GitHub without your explicit approval.
          </p>
        </div>
      </section>

      {/* sponsors */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 text-center">
        <div className="text-xs uppercase tracking-widest text-slate-500">Built on open-weight + sponsor stack</div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {SPONSORS.map((sp) => (
            <span key={sp} className="chip border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
              {sp}
            </span>
          ))}
        </div>
      </section>

      {/* final CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 text-center">
        <h2 className="text-3xl font-black text-slate-50">Ready to strike paydirt?</h2>
        <p className="mx-auto mt-2 max-w-lg text-slate-400">
          Ingest your GitHub profile and watch the board re-rank to what you can actually win.
        </p>
        <button onClick={onEnter} className="btn-gold mt-6 text-base">
          Enter the dashboard →
        </button>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-6 text-center text-xs text-slate-600">
        Paydirt · built for DEV × Hacktoberfest 2026 · MIT · open-weight AI that belongs to everyone
      </footer>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`card p-4 text-left ${accent ? "!border-gold-500/30" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-black ${accent ? "text-gold-400" : "text-slate-50"}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
