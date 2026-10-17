# ⛏️ Paydirt — Product Requirements Document (PRD)

> **"Turn open source into paydirt."**  
> An open-weight AI agent that discovers bountied GitHub issues, predicts payout probability, matches them to developer skills locally, and durably tracks claims through PR, merge, and payout.

---

## 1. Executive Summary & Vision

### 1.1 The Problem
Developers who want paid open-source work waste countless hours on bounties that never pay out:
- **Abandoned issues**: Bounties posted on repositories with inactive maintainers.
- **Silent maintainers**: High latency or zero response on submitted pull requests.
- **Dead repositories**: Outdated dependency trees and unmerged PR backlogs.
- **Privacy leak risk**: Proprietary code sent to third-party closed-source cloud LLMs.

### 1.2 The Solution: Paydirt
Paydirt answers one question per bounty: **"Is this worth my time, and what is its expected value per hour?"**
```
EV/hr = P(success) × bounty_amount ÷ est_hours × (0.5 + 0.5 × match_score)
```

### 1.3 Hacktoberfest 2026 Theme Alignment
- **Theme**: *"AI belongs to everyone"* · Side Hustle track.
- **Open-weight, not per-token**: Embeddings and reasoning execute locally with Gemma via Ollama. Private code never touches cloud APIs.
- **Honest by default**: Every dependency (Docker, Temporal, Postgres, TabPFN, Ollama) degrades gracefully to deterministic, labeled fallbacks. No fabricated data.
- **Human-in-the-loop**: The agent drafts plans and pull requests (`DRY_RUN=true`). It **never** posts without explicit developer confirmation.

---

## 2. Sponsor Technologies Exercised

| Sponsor / Partner | Purpose in Paydirt |
|---|---|
| **Prior Labs (TabPFN)** | Tabular foundation model predicting `P(paid ≤ 30d)` and days-to-merge from anonymous feature rows. |
| **Gemma / Ollama** | Open-weight local LLM (`gemma3:4b` + `embeddinggemma`) for private skill embeddings and PR drafting. |
| **Tiger Data** | Timescale hypertable for maintainer events + pgvector embeddings storage. |
| **Temporal** | Event-sourced durable workflows surviving process restarts (`BountyLifecycleWorkflow`, `DiscoveryWorkflow`). |
| **Sentry** | Distributed tracing and error telemetry in Fastify API, Temporal worker, and Python sidecar. |
| **DigitalOcean** | Production container deployment & droplet infrastructure. |
| **Render** | Backend web service hosting for public demo. |
| **GoDaddy** | `.tech` domain landing for community access. |
| **MongoDB** | Secondary storage integration & document parsing. |

---

## 3. System Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│                   React 18 + Vite Web UI              │
│       (Neobrutalist Styling · Board · Detail · Tracker)│
└───────────────────────────┬────────────────────────────┘
                            │ REST / JSON (Zod validated)
┌───────────────────────────▼────────────────────────────┐
│                    Fastify API (:3000)                 │
│         Dual Driver: Postgres (Tiger Data) OR Memory   │
└──────────────┬─────────────────────────────┬───────────┘
               │                             │
    Signals &  │                  Prediction │ Feature
    Workflow   │                  Inference  │ Vectors
               ▼                             ▼
┌───────────────────────────────┐  ┌─────────────────────┐
│       Temporal Worker         │  │   Python Sidecar    │
│  - DiscoveryWorkflow          │  │     (:8000)         │
│  - BountyLifecycleWorkflow    │  │  - TabPFN (Prior)   │
│  - RetrainWorkflow            │  │  - Logistic baseline│
└──────────────┬────────────────┘  └─────────────────────┘
               │
    ┌──────────┴─────────────────────────┐
    │ Activities:                        │
    │  • GitHub Search API (rate-aware)  │
    │  • Local Gemma via Ollama (:11434) │
    │  • Tiger Data / Timescale SQL      │
    │  • Sentry Error Interceptors       │
    └────────────────────────────────────┘
```

---

## 4. Security & Privacy Boundary

| Data Classification | Destination | Guarantee |
|---|---|---|
| **User Repo Code & Notes** | Local machine only | Embedded via local Gemma on Ollama; never leaves disk. |
| **Tabular Features** | Prior Labs TabPFN | Anonymous numeric/categorical rows only (stars, forks, days, labels). No usernames or code. |
| **Discovery Searches** | GitHub Search API | Read-only public queries; no authentication token leakage. |
| **PR & Comment Submissions** | Developer approval | `DRY_RUN=true` default; human-in-the-loop required for any write. |

---

## 5. Core Entities & Data Contracts (`@paydirt/shared`)

### 5.1 Issue & Repository Models
- **`Issue`**: Unique GitHub issue reference, bounty amount (parsed from labels/body), currency, comment count, and claimant count.
- **`Repo`**: Stars, forks, language, open issues, and historical push activity.
- **`FeatureRow`**: Normalized vector passed to TabPFN:
  - `bountyAmount` (USD float)
  - `repoStars`, `repoForks`, `repoAgeDays`
  - `maintainerMergeRatePrior90d`
  - `maintainerMedianFirstResponseHoursPrior90d`
  - `commentCountAtSnapshot`, `claimantCountAtSnapshot`
  - `bodyLength`, `hasGoodFirstIssueLabel`
- **`Prediction`**: `pSuccess` (0–1), `daysToMergeEst`, `evPerHour`, `matchScore`, `modelVersion`.

### 5.2 Bounty Lifecycle State Machine
```
CLAIMED ──> WORKING ──> PR_OPEN ──> IN_REVIEW ──> MERGED ──> PAID
   │            │           │            │           │
   └───[ABANDON]┴───────────┴────────────┴───────────┘
```
1. **CLAIMED**: Bounty claimed by developer; Temporal workflow initialized.
2. **WORKING**: Developer actively drafting code or local plan.
3. **PR_OPEN**: Pull request submitted; URL attached.
4. **IN_REVIEW**: Maintainer comments or review requests detected.
5. **MERGED**: Pull request merged; payout state set to `pending`.
6. **PAID**: Bounty funds verified; workflow completes successfully.

---

## 6. Frontend Design Specifications (Neobrutalism)

- **Typography**: `Space Grotesk` (display headings) + `JetBrains Mono` (metrics, code, badges) + `Inter` (body).
- **Palette**:
  - Dark Charcoal Canvas (`#0c0e14`, `#151922`, `#1c222e`)
  - Miner's Gold (`#fde047`, `#eab308`)
  - Cyber Cyan (`#22d3ee`, `#06b6d4`)
  - Acid Emerald (`#4ade80`, `#22c55e`)
  - Hot Pink (`#f472b6`, `#ec4899`)
- **Tactile UI Controls**:
  - Hard borders (`border-2 border-slate-700` or `border-2 border-black`).
  - Solid geometric drop shadows (`box-shadow: 4px 4px 0px #000`).
  - Active press mechanics (`active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`).
  - Real-time diagnostic pill with blinking status dot.

---

## 7. Verification & Testing Standards

All modules are strictly verified before merge:
- **TypeScript Typecheck**: `npm run typecheck` across root, shared, api, and worker.
- **Unit & Contract Tests**: `npm test -w @paydirt/shared` (Zod schemas, matching algorithms, label extraction).
- **Workflow Tests**: `npm test -w @paydirt/worker` (Temporal lifecycle state transitions).
- **Python Predictor Tests**: `pytest services/predictor` (TabPFN, logistic baselines, time-split evaluation).
- **Frontend Production Build**: `npm run build -w @paydirt/web` via Vite.
