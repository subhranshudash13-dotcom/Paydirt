# Paydirt — Decision Log

Non-obvious choices, kept honest so a reviewer can follow the reasoning.
Format: **Decision → Why → Trade-off / revisit when.**

## 2026-10-15 — Product name: Paydirt (was QUARRY)
- **Why:** "strike paydirt" = find the money; keeps the mining DNA of the working name and nails the Hacktoberfest "Side Hustle" theme.
- **Trade-off:** "Paydirt" is also used by an unrelated payroll product. Acceptable for a hackathon prototype. **Revisit before any commercial launch** (candidates: Sluice, Lode).

## 2026-10-15 — npm workspaces instead of pnpm (PRD §3)
- **Why:** pnpm can't be installed in the build sandbox (corepack can't write to Program Files). The PRD says "working beats ambitious."
- **Trade-off:** `pnpm-workspace.yaml` semantics differ slightly; a committed `package-lock.json` is the source of truth. Everything runs with stock Node/npm. Can switch to pnpm later with no layout change.

## 2026-10-15 — timescaledb-ha as the local Tiger Data stand-in
- **Why:** the `-ha` image bundles Timescale + pgvector so `make up` gives a single Postgres that satisfies the DB, hypertable, and vector needs.
- **Revisit:** when deploying, point `DATABASE_URL` at a real Tiger Data instance; the SQL is portable.

## 2026-10-15 — Dual data layer: Postgres driver + in-memory fallback
- **Why:** the build sandbox has no running Docker daemon, so Timescale/pgvector/Temporal/Ollama are not reachable here. To keep the site *visibly running with real data* (user preference: visibility-first + data authenticity), the API abstracts storage behind a repository interface with a `postgres` driver (the real path) and a `memory` driver seeded with real bountied-issue data (Algora-style bounty labels). The driver is chosen by whether `DATABASE_URL` connects.
- **Trade-off:** the memory driver is a demo seed, not live discovery; run `make up` + the collector for the full path. Same SQL schema and query shapes are exercised by the postgres driver.

## 2026-10-15 — Loop Engineering as the build method
- **Why:** each "loop" is one demoable vertical slice gated by an acceptance check before the next starts; matches PRD §12 phase gates and prevents big-bang builds.
- **Manifestation:** `make loop*` targets, per-loop commits, `docs/DECISIONS.md` entries.

## 2026-10-15 — Data-authenticity + visibility-first defaults (user preference)
- **Why:** the board must show *real, ranked, scored* data and the UI must make state visibly correct — a working-but-invisible demo builds no trust.
- **Manifestation:** the collector (Phase 1) is the real path; a deterministic seed guarantees the UI is populated for demos even before live pulls.
