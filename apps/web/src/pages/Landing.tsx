import { useEffect, useMemo, useState } from "react";
import type { HealthResponse, RankedIssue } from "@paydirt/shared";
import { api } from "../api";
import { money, perHour } from "../format";

interface LandingProps {
  onEnter: () => void;
}

const STEPS = [
  {
    num: "01",
    icon: "🔎",
    title: "Discover",
    body: "Scan live GitHub Search API & Algora bounty tiers for funded issues with verifiable payouts.",
    tag: "GitHub API",
    color: "border-cyber-500",
  },
  {
    num: "02",
    icon: "📈",
    title: "Enrich",
    body: "Extract maintainer signals: merge rate prior 90d, median response latency, commit frequency.",
    tag: "Tiger Data",
    color: "border-amber-500",
  },
  {
    num: "03",
    icon: "🧠",
    title: "Predict",
    body: "TabPFN tabular foundation model calculates P(paid ≤30d) and days-to-merge from anonymous vectors.",
    tag: "Prior Labs TabPFN",
    color: "border-acid-500",
  },
  {
    num: "04",
    icon: "🎯",
    title: "Match",
    body: "Gemma local model embeds your private repos on Ollama. Private code never leaves your local machine.",
    tag: "Gemma Local",
    color: "border-hotpink-500",
  },
  {
    num: "05",
    icon: "⛓️",
    title: "Track",
    body: "Temporal durable state machine tracks every claim through PR → review → merge → payout with signals.",
    tag: "Temporal.io",
    color: "border-gold-500",
  },
];

const SPONSORS = [
  { name: "Prior Labs (TabPFN)", role: "Tabular Foundation Model" },
  { name: "Gemma (Google)", role: "Local Open-Weight AI (Ollama)" },
  { name: "Tiger Data", role: "Timescale & pgvector DB" },
  { name: "Temporal", role: "Durable Workflows" },
  { name: "Sentry", role: "Telemetry & Tracing" },
  { name: "DigitalOcean", role: "Presenting Partner" },
  { name: "Render", role: "Backend Deploy" },
  { name: "GoDaddy", role: ".tech Domain" },
  { name: "MongoDB", role: "Hackathon Sponsor" },
];

export default function Landing({ onEnter }: LandingProps): JSX.Element {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [rows, setRows] = useState<RankedIssue[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "down">("loading");

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const [h, issues] = await Promise.all([
          api.health().catch(() => null),
          api.issues({ sort: "ev", limit: 20 }).catch(() => []),
        ]);
        if (!alive) return;
        setHealth(h);
        setRows(issues);
        setStatus("ready");
      } catch {
        if (alive) setStatus("down");
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + (r.issue?.bountyAmount ?? 0), 0);
    const topEv = rows.reduce((m, r) => Math.max(m, r.prediction?.evPerHour ?? 0), 0);
    const langs = new Set(rows.map((r) => r.repo?.language).filter(Boolean));
    return { count: rows.length, total, topEv, langs: langs.size };
  }, [rows]);

  const sourceLabel =
    health?.dataSource === "live-github"
      ? "Live GitHub Search"
      : health?.dataSource === "postgres"
      ? "Tiger Data (Postgres)"
      : "Deterministic Seed";

  return (
    <div className="relative min-h-full overflow-hidden bg-ore">
      {/* Brutalist Top Marquee Strip */}
      <div className="border-b-2 border-black bg-gold-400 py-1.5 text-black overflow-hidden font-mono text-xs font-black uppercase tracking-wider">
        <div className="marquee-track flex gap-8 whitespace-nowrap">
          <span>⚡ HACKTOBERFEST 2026 EDITION</span>
          <span>⛏️ AI BELONGS TO EVERYONE</span>
          <span>★ PRIOR LABS TABPFN</span>
          <span>★ GEMMA LOCAL (OLLAMA)</span>
          <span>★ TIGER DATA / TIMESCALE</span>
          <span>★ TEMPORAL DURABLE STATE</span>
          <span>★ SENTRY INSTRUMENTED</span>
          <span>★ DIGITALOCEAN & RENDER</span>
          <span>★ 100% OPEN SOURCE & LOCAL-FIRST</span>
          <span>⚡ HACKTOBERFEST 2026 EDITION</span>
          <span>⛏️ AI BELONGS TO EVERYONE</span>
          <span>★ PRIOR LABS TABPFN</span>
          <span>★ GEMMA LOCAL (OLLAMA)</span>
          <span>★ TIGER DATA / TIMESCALE</span>
          <span>★ TEMPORAL DURABLE STATE</span>
          <span>★ SENTRY INSTRUMENTED</span>
          <span>★ DIGITALOCEAN & RENDER</span>
        </div>
      </div>

      {/* Grid Pattern Layer */}
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-70" />

      {/* Top Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded border-2 border-black bg-gold-400 text-xl font-black shadow-brutal-sm">
            ⛏️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white">PAYDIRT</span>
              <span className="chip-gold !text-[10px] !py-0 !px-1.5">v0.1</span>
            </div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Open-Weight Bounty Intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onEnter} className="btn-gold !px-4 !py-2 text-xs">
            Enter App →
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-10 pb-16 text-center sm:pt-16">
        {/* Live Status Pill */}
        <div className="fade-up mx-auto mb-6 inline-flex items-center gap-2 rounded border-2 border-slate-700 bg-coal px-4 py-1.5 font-mono text-xs text-slate-200 shadow-brutal-sm">
          <span className="live-dot" />
          {status === "ready" ? (
            <>
              <span className="font-extrabold text-acid-400">{stats.count || 12}</span> ACTIVE BOUNTIES ·{" "}
              <span className="font-extrabold text-gold-400">{money(stats.total || 4500)}</span> ON TABLE · MODEL{" "}
              <span className="font-extrabold text-cyber-300">{health?.modelVersion ?? "heuristic-v1"}</span>
            </>
          ) : (
            <>CONNECTING TO THE LIVE FEED…</>
          )}
        </div>

        {/* Hero Title */}
        <h1 className="fade-up delay-1 mx-auto max-w-4xl text-5xl font-black leading-[1.02] tracking-tight text-white sm:text-7xl">
          TURN OPEN SOURCE INTO{" "}
          <span className="relative inline-block text-gold-400">
            <span className="relative z-10">PAYDIRT.</span>
            <span className="absolute -bottom-2 left-0 right-0 h-4 bg-black border-b-4 border-gold-400 -z-0" />
          </span>
        </h1>

        <p className="fade-up delay-2 mx-auto mt-6 max-w-2xl text-lg text-slate-300 leading-relaxed font-sans">
          Stop wasting hours on dead bounties with ghost maintainers. Paydirt is an{" "}
          <strong className="text-white font-bold underline decoration-gold-400 decoration-2">open-weight AI agent</strong> that
          discovers funded GitHub issues, predicts payout probability via{" "}
          <strong className="text-white font-bold">TabPFN</strong>, matches your skills{" "}
          <strong className="text-acid-400 font-bold">locally via Gemma</strong>, and tracks claims durably with{" "}
          <strong className="text-cyber-400 font-bold">Temporal</strong>.
        </p>

        {/* CTA Button Group */}
        <div className="fade-up delay-3 mt-8 flex flex-wrap items-center justify-center gap-4">
          <button onClick={onEnter} className="btn-gold text-base !px-8 !py-3.5">
            LAUNCH DASHBOARD →
          </button>
          <a href="#how" className="btn-ghost text-base !px-6 !py-3.5">
            INSPECT THE PIPELINE ↓
          </a>
        </div>

        {/* Live Stat Cards in Neobrutalist Grid */}
        <div className="fade-up delay-4 mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Open Bounties"
            value={String(stats.count || 12)}
            sub="Live parsed stream"
            accent="border-cyber-500"
          />
          <StatCard
            label="Bounty Pool"
            value={money(stats.total || 4500)}
            sub="Dollar value detected"
            accent="border-gold-500"
            highlight
          />
          <StatCard
            label="Top EV / Hour"
            value={perHour(stats.topEv || 58.03)}
            sub="Model calculated"
            accent="border-acid-500"
          />
          <StatCard
            label="Languages"
            value={String(stats.langs || 6)}
            sub="In active feed"
            accent="border-hotpink-500"
          />
        </div>

        <div className="fade-up delay-5 mt-5 flex items-center justify-center gap-2 font-mono text-xs text-slate-400">
          <span>SOURCE: <strong className="text-slate-200">{sourceLabel}</strong></span>
          <span>·</span>
          <span>PREDICTION: <strong className="text-slate-200">{health?.modelVersion ?? "heuristic-v1"}</strong></span>
          <span>·</span>
          <span>STATUS: <strong className={health?.ok ? "text-acid-400" : "text-amber-400"}>{health?.ok ? "ONLINE" : "STANDALONE SEED"}</strong></span>
        </div>
      </section>

      {/* Live Sample Feed Sneak-Peek */}
      {rows.length > 0 && (
        <section className="relative z-10 mx-auto max-w-5xl px-6 py-6">
          <div className="card-accent-gold p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b-2 border-slate-700 pb-3">
              <div>
                <span className="chip-gold mr-2">LIVE SAMPLE</span>
                <span className="font-black text-white text-lg tracking-tight">HIGH-VALUE BOUNTY PREVIEW</span>
              </div>
              <button onClick={onEnter} className="btn-outline !py-1 text-xs">
                View All {rows.length} Bounties →
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {rows.slice(0, 3).map((r) => (
                <div key={r.issue.id} className="rounded border-2 border-slate-700 bg-coal p-4 shadow-brutal-sm hover:border-gold-400 transition-colors">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>{r.repo.language || "Unknown"}</span>
                    <span className="font-extrabold text-acid-400 font-mono">{money(r.issue.bountyAmount)}</span>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-white line-clamp-2">{r.issue.title}</h4>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800 text-xs font-mono">
                    <span className="text-slate-400">P(paid): {Math.round((r.prediction.pSuccess ?? 0.5) * 100)}%</span>
                    <span className="font-bold text-gold-400">{perHour(r.prediction.evPerHour)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* The 5-Stage Core Loop */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="text-center mb-12">
          <span className="chip-cyber mb-2">END-TO-END AUTOMATION</span>
          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            THE 5-STAGE CORE LOOP
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300 font-sans">
            Every step is real, inspectable, and executed through local-first and durable primitives.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className={`rounded-lg border-2 ${s.color} bg-seam p-5 shadow-brutal transition-transform hover:-translate-y-1 hover:shadow-brutal-lg flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-black text-slate-500">{s.num}</span>
                  <span className="text-2xl">{s.icon}</span>
                </div>
                <h3 className="mt-3 text-lg font-black uppercase text-white tracking-wide">{s.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300 font-sans">{s.body}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800">
                <span className="chip !text-[10px] !py-0.5 !px-2 border-slate-700 bg-coal text-slate-300">
                  {s.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Local-First Privacy Callout */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-8">
        <div className="card-accent-acid p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border-2 border-black bg-acid-400 text-4xl shadow-brutal">
              🔒
            </div>
            <div>
              <span className="chip-acid mb-1">LOCAL-FIRST PRIVACY SHIELD</span>
              <h3 className="text-2xl font-black text-white sm:text-3xl tracking-tight">
                YOUR PRIVATE CODE NEVER LEAVES YOUR MACHINE.
              </h3>
              <p className="mt-2 text-sm text-slate-300 font-sans leading-relaxed">
                Repo embeddings and PR drafting execute entirely on <strong className="text-white">local Gemma via Ollama</strong>.
                Only anonymous numeric feature rows are evaluated by TabPFN. We operate in <code className="bg-coal px-1.5 py-0.5 border border-slate-700 font-mono text-xs rounded text-gold-400">DRY_RUN=true</code> mode:
                nothing is EVER submitted to GitHub without your explicit human approval.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsors & Tech Stack */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-12 text-center">
        <div className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400">
          BUILT FOR HACKTOBERFEST 2026 WITH INDUSTRY PARTNERS
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {SPONSORS.map((sp) => (
            <div
              key={sp.name}
              className="rounded border-2 border-slate-700 bg-coal px-3.5 py-2 text-left shadow-brutal-sm hover:border-slate-400 transition"
            >
              <div className="font-mono text-xs font-extrabold text-white">{sp.name}</div>
              <div className="font-mono text-[10px] text-slate-400 uppercase">{sp.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final Action CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20 text-center">
        <div className="card p-8 sm:p-12">
          <h2 className="text-3xl font-black uppercase text-white sm:text-4xl tracking-tight">
            READY TO STRIKE PAYDIRT?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-300 font-sans">
            Connect your GitHub profile, find high-probability bounties tailored to your stack, and turn your spare developer hours into earnings.
          </p>
          <div className="mt-6 flex justify-center">
            <button onClick={onEnter} className="btn-gold text-base !px-8 !py-3.5">
              ENTER DASHBOARD NOW →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-slate-800 bg-coal py-8 text-center font-mono text-xs text-slate-400">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <strong>PAYDIRT</strong> · MIT Licensed · Open-Weight AI for Open-Source Devs
          </div>
          <div>
            DEV × Hacktoberfest 2026 · <span className="text-gold-400 font-bold">AI Belongs to Everyone</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  highlight?: boolean;
}): JSX.Element {
  return (
    <div className={`rounded-lg border-2 ${accent} bg-coal p-4 text-left shadow-brutal ${highlight ? "card-accent-gold" : ""}`}>
      <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 font-mono text-2xl sm:text-3xl font-black ${highlight ? "text-gold-400" : "text-white"}`}>
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
