# Paydirt — Architecture

```
                          +----------------------+
                          |    React UI (Vite)   |
                          | Board|Detail|Tracker |
                          | Model | Privacy      |
                          +----------+-----------+
                                     | REST/JSON
                          +----------v-----------+
                          |   API (Fastify, TS)  |  zod-validated
                          +--+---------+------+--+
              start/signal   |         |      |  SQL
        +--------------------+         |      +---------------------+
        |                              |                            |
+-------v--------+            +--------v--------+        +----------v-----------+
|  Temporal      |            | Python sidecar  |        | Postgres (Tiger Data) |
|  server        |            | FastAPI         |        |  issues, repos        |
+-------+--------+            |  /train/predict |        |  hypertable: maintainer_events
        |                     |  TabPFN (Prior) |        |  pgvector(768) + tsvector
+-------v--------+            +-----------------+        +----------------------+
| Temporal worker|                                       ^
| (TS activities)|---------------------------------------+
+--+---+---+--+--+   reads/writes
   |   |   |  |
   |   |   |  +--> Ollama (Gemma chat + EmbeddingGemma)  [LOCAL, open-weight]
   |   |   +-----> SerpApi (bounty discovery outside GitHub)
   |   +---------> GitHub REST API (issues, PRs, comments, repo stats)
   +-------------> Sentry (traces for every workflow/activity)
```

## Data boundary (surfaced in the UI Privacy panel)
- **LOCAL only:** the user's repo contents, README/code embeddings, Gemma drafts. Private code never leaves the machine.
- **To TabPFN:** anonymous numeric/categorical feature rows only — no code, no usernames.
- **To GitHub/SerpApi:** only search queries and public API calls.

## Workflows (Temporal — durability is the point)
- **DiscoveryWorkflow** (every 6h): search → upsert → enrich → embed (Ollama) → score (sidecar) → rank.
- **BountyLifecycleWorkflow** (one per tracked issue, days–weeks): CLAIMED → WORKING → PR_OPEN → IN_REVIEW → MERGED → PAYOUT_PENDING → PAID|ABANDONED, with signals/timers/queries; survives worker restarts.
- **RetrainWorkflow** (weekly): rebuild features, call `/train`, store metrics + model_version.

## Sponsors used (Hacktoberfest 2026)
Gemma (open-weight, via Ollama) · Prior Labs TabPFN · Tiger Data/Timescale+pgvector · Temporal · Sentry · DigitalOcean (presenting partner) · Render/GoDaddy .tech (deploy).
