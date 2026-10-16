<div align="center">

# ⛏️ Paydirt

> **Turn open source into paydirt.** An open-weight AI agent that discovers bountied
> GitHub issues, predicts which are actually worth your time, matches them to your
> skills — *locally* — and durably tracks every claim from `claim → PR → review → merge → payout`.

**Hacktoberfest 2026** · theme *"AI belongs to everyone"* / Side Hustle · `MIT licensed` · Node ≥ 20

`TabPFN` · `Gemma / Ollama` · `Temporal` · `Tiger Data` · `Sentry` · `Fastify` · `React`

</div>

---

Developers who want paid open-source work waste hours on bounties that never pay —
abandoned issues, silent maintainers, dead repos. Paydirt answers one question per
issue: **"is this worth my time, and what is it worth per hour?"**

```
EV/hr = P(success) × bounty_amount ÷ est_hours × (0.5 + 0.5 × match_score)
```

## ✨ What makes it different

- **Open-weight, not per-token.** Your repos, notes and drafts are embedded and read
  **locally** with a Gemma model via Ollama. Private code never goes to a third-party LLM.
- **Honest by default.** Every external service (GitHub, Ollama, TabPFN, Temporal,
  Postgres, Sentry) is **optional**. With no keys or Docker the whole product still runs
  in an offline demo mode with clearly-labelled fallbacks — nothing is ever fabricated
  or silently faked.
- **Human-in-the-loop.** The agent *drafts* plans, PR descriptions and follow-ups. It
  **never** posts to GitHub without your explicit approval (`DRY_RUN=true` default).
- **Durable.** Claimed bounties are tracked in Temporal workflows that survive worker
  restarts across a multi-day, real-world lifecycle.

## 🔁 The core loop

1. **Discover** — bountied issues via the GitHub Search API (+ SerpApi for off-platform boards).
2. **Enrich** — repo & maintainer signals (first-response latency, merge rate) from a Timescale hypertable.
3. **Predict** — `P(paid / merged within 30 days)` and days-to-merge with a tabular foundation model (**TabPFN**).
4. **Match** — score against *your* skills using **local** EmbeddingGemma vectors of your own repos.
5. **Rank** — by expected value per hour.
6. **Track** — each claim lives in a durable Temporal workflow.
7. **Draft** — a plan / PR body / follow-up with local Gemma. You approve; it never auto-submits.

## 🧱 Status — what's actually built

Paydirt was assembled with **Loop Engineering** — each loop is a demoable vertical slice
(Plan → Build → Verify → Commit). Done so far:

| Slice | What ships | Verified |
|---|---|---|
| Scaffold | npm-workspaces monorepo, Docker stack, SQL migrations, `Makefile` | ✅ `make` targets + `/api/health` |
| Shared | zod contracts, bounty-label detection, matching primitives | ✅ 19 unit tests |
| API | Fastify, dual data driver (Postgres **or** in-memory), ranked board | ✅ live endpoints |
| Web UI | Board · Detail · Tracker · Model · Privacy · Profile (Vite + Tailwind) | ✅ browser click-through |
| Predictor | Python FastAPI sidecar — TabPFN **with an honest logistic baseline** + time-split eval | ✅ `/health /predict /train` |
| Worker | Temporal Discovery / Lifecycle / Retrain workflows, gated activities | ✅ 8 lifecycle tests + live discovery |
| Matching + Drafts | profile ingest → real skill match re-ranks EV; Gemma drafts (or labelled template) | ✅ real GitHub login ingest |
| Sentry | DSN-gated error reporting in API + worker, visible status | ✅ offline no-op + enable path |

> **Ranking model:** the API board ranks with a documented heuristic (`heuristic-v1`);
> the Python sidecar serves the model-backed path (**TabPFN** when a key is set, an
> honest **logistic** baseline otherwise) that discovery uses. Reported model/version are
> whatever actually served the number — see the Model tab.

## 🚀 Quickstart

### Zero-setup offline demo (no Docker, no keys)
```bash
npm install
npm run build
node apps/api/dist/server.js        # API on :3000 (in-memory seed, honest fallbacks)
npm run dev -w @paydirt/web          # UI  on :5173  → open http://localhost:5173
```
The UI comes up with a real, ranked board. The `/api/health` endpoint (and the in-app
status dots) report exactly which services are live vs. degraded.

### Full local stack (real data + models)
```bash
cp .env.example .env                 # add keys for the live path; blank = offline demo
make up                              # Postgres/Tiger Data + Ollama + Temporal
make models                          # pull gemma3:4b + embeddinggemma (open-weight, local)
make install migrate                # deps + SQL
npm run dev -w @paydirt/api &        # API (watch)
npm run dev -w @paydirt/worker &     # Temporal worker
npm run dev -w @paydirt/web &        # UI
# open http://localhost:5173
```
Add a `SENTRY_DSN` to route caught errors to Sentry; leave it blank and error reporting
is a clean no-op (the Privacy panel tells you which state you're in).

## 🏗️ Architecture
```
React UI ⇄ Fastify API (zod) ⇄ Postgres/Tiger Data (Timescale + pgvector + tsvector)
                │                       │
                ├── Temporal worker ────┤  GitHub API · SerpApi
                └── Python sidecar ─────┘  TabPFN (Prior Labs)
        Ollama (Gemma chat + EmbeddingGemma)  [LOCAL]   ·   Sentry (API + worker)
```
Details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); non-obvious choices in
[`docs/DECISIONS.md`](docs/DECISIONS.md).

### Data boundary
| Stays **local** | Sent to **TabPFN** | Sent to **GitHub / SerpApi** |
|---|---|---|
| Repo contents, README/code embeddings, Gemma drafts | anonymous numeric/categorical feature rows | search queries + public API calls |

Nothing is ever posted to GitHub without explicit approval.

## 🔌 API reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | ok + which services are live (`db · temporal · predictor · ollama · sentry`) |
| `GET` | `/api/issues?sort=ev\|bounty\|p\|match\|days&language=&minEv=&limit=` | ranked board |
| `GET` | `/api/issues/:id` | detail + prediction + explanation |
| `GET` | `/api/search?q=&k=` | keyword / hybrid search |
| `GET` | `/api/model` | model version + honest metrics vs baselines |
| `GET`/`POST` | `/api/track` · `/api/:id/signal` | list + start/update a lifecycle workflow |
| `POST` | `/api/profile/ingest {githubLogin}` | read public repos → derive skills/languages → re-rank board |
| `GET` | `/api/profile` | active skill profile |
| `POST` | `/api/drafts/plan {issueId}` | Gemma plan draft (dry-run, never posted) |
| `GET` | `/api/parse-labels?labels=…` | shows the bounty-label parser is real |

## 🧪 Testing
```bash
npm run typecheck                    # tsc across shared + api + worker
npm run test -w @paydirt/shared      # zod contracts, labels, matching (vitest)
npm run test -w @paydirt/worker      # Temporal lifecycle (vitest)
npm run discovery:once -w @paydirt/worker   # live discover→score→rank, no Temporal needed
# Python sidecar: cd services/predictor && pytest
```

## 📂 Repo layout
```
apps/api           Fastify REST API (dual data driver, zod, Sentry)
apps/worker        Temporal worker (workflows + gated activities + Sentry interceptor)
apps/web           React UI — Board · Detail · Tracker · Model · Profile · Privacy
services/predictor Python FastAPI + TabPFN sidecar (logistic baseline, time-split eval)
packages/shared    zod schemas + shared TS types (labels, matching, contracts)
db/migrations      SQL (Timescale hypertable, pgvector, tsvector)
docs/              ARCHITECTURE · DECISIONS
temporal/ · docker-compose.yml · Makefile
```

## 🤝 Hacktoberfest 2026 sponsors exercised
**Prior Labs (TabPFN)** · **Gemma** (local via **Ollama**) · **Temporal** ·
**Tiger Data** (Timescale + pgvector) · **Sentry** · **DigitalOcean** (presenting partner) ·
**Render** (backend deploy) · **GoDaddy** (`.tech` landing) · **MongoDB** · **GitHub**.

## 🧭 Roadmap / not built yet
Honest gaps for the remaining phases:
- **Phase 1 data gate** — bulk historical outcome collection + `DATA_REPORT` (currently a demo seed + live discovery sample).
- **SerpApi** discovery breadth for off-platform bounty boards.
- **True hybrid search** (tsvector + pgvector reciprocal-rank fusion) in the Postgres path.
- **Deploy** — `.tech` landing page + Render/DigitalOcean backend, and a recorded demo.

## 📄 License
- Code: **MIT** (see [`LICENSE`](LICENSE)).
- **TabPFN's free key is non-commercial** — this build is hackathon/research use;
  commercial use requires a licence from [Prior Labs](https://priorlabs.ai).
