# ⛏️ Paydirt

> **Turn open source into paydirt.** An open-weight AI agent that finds bountied GitHub
> issues, predicts which are actually worth your time, matches them to your skills — locally —
> and durably tracks each claimed bounty from `claim → PR → review → merge → payout`.

Built for **DEV × Hacktoberfest 2026** — theme *"AI belongs to everyone"* / Side Hustle.
Paydirt is an **open-source AI agent**: it discovers paid/bountied issues, scores them with a
tabular foundation model ([Prior Labs **TabPFN**](https://priorlabs.ai)), reads your code with
an **open-weight Gemma** running **locally** via Ollama, and keeps every claim alive across days
with **Temporal**.

---

## Why this exists

Developers who want paid open-source work waste hours on bounties that never pay — abandoned
issues, silent maintainers, dead repos. Paydirt answers one question per issue:
**"is this worth my time, and what's it worth per hour?"**

`EV/hr = P(success) × bounty_amount ÷ est_hours × (0.5 + 0.5 × match_score)`

## The core loop
1. **Discover** bountied issues — GitHub Search + SerpApi for off-platform boards (Algora-style).
2. **Enrich** with repo + maintainer signals (response time, merge rate) from a Timescale hypertable.
3. **Predict** P(paid/merged within 30 days) + days-to-merge with TabPFN.
4. **Match** to your skills via **local** EmbeddingGemma vectors of your own repos.
5. **Rank** by expected value per hour.
6. **Track** each claim in a durable Temporal workflow that survives worker restarts.
7. **Draft** (never auto-submit) a plan / PR description / follow-up with local Gemma. You approve.

## Why open-weight / open-source matters
- **Privacy:** your repos, notes, and drafts are embedded and read **locally** (Gemma via Ollama).
  Private code never goes to a third-party LLM. Only anonymous numeric feature rows go to TabPFN.
- **No per-token cost** and **no lock-in**: swap the chat or embedding model without touching the app.
- **Reproducible for judges:** the whole stack comes up with `docker compose up`.

## Privacy boundary
| Stays local | Sent to TabPFN | Sent to GitHub/SerpApi |
|---|---|---|
| Repo contents, README/code embeddings, Gemma drafts | anonymous numeric/categorical feature rows | search queries + public API calls |

Nothing is ever posted to GitHub without `DRY_RUN=false` **and** explicit approval in the UI.

## Quickstart

```bash
cp .env.example .env      # add keys to run the live path; blank = offline demo mode
make up                   # db (Timescale+pgvector) + ollama + temporal
make models               # pull gemma3:4b + embeddinggemma (open-weight, local)
make install              # workspace deps
make migrate              # apply SQL
make dev-api & make dev-web
# open http://localhost:5173
```

`make loop1` runs the whole scaffold + health gate in one shot. See the `Makefile` for targets.

## Architecture
```
React UI ⇄ Fastify API (zod) ⇄ Postgres/Tiger Data (Timescale + pgvector + tsvector)
                │                       │
                ├── Temporal worker ────┤  GitHub API · SerpApi
                └── Python sidecar ─────┘  TabPFN (Prior Labs)
                Ollama (Gemma chat + EmbeddingGemma)  [LOCAL]   ·   Sentry traces everywhere
```
Full diagram and workflow state machines in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Decision log in [`docs/DECISIONS.md`](docs/DECISIONS.md). Data findings in [`docs/DATA_REPORT.md`](docs/DATA_REPORT.md).

## Tech stack
Fastify + zod + TypeScript · **Temporal** (TS SDK) · **Postgres via Tiger Data** (`timescaledb-ha`: Timescale + pgvector) ·
**TabPFN** sidecar (Python FastAPI) · **Gemma / EmbeddingGemma via Ollama** · SerpApi · **Sentry** · React + Vite + Tailwind ·
**npm workspaces** (see [DECISIONS](docs/DECISIONS.md)).

## Hacktoberfest 2026 sponsors exercised
DigitalOcean (presenting partner) · Prior Labs (TabPFN) · Tiger Data · Gemma · Temporal · Sentry ·
MongoDB · Render · GoDaddy (.tech domain) · GitHub.

## License & notes
- Code: **MIT**.
- **TabPFN free key is non-commercial** — this build is hackathon/research use; commercial use needs a licence.

## Repo layout
```
apps/api        Fastify REST API
apps/worker     Temporal worker (workflows + activities)
apps/web        React UI — Board · Detail · Tracker · Model · Privacy
services/predictor  Python FastAPI + TabPFN sidecar
packages/shared     zod schemas + shared TS types
db/migrations       SQL
scripts/            data collector + model eval
docs/               ARCHITECTURE · DECISIONS · DATA_REPORT
```
