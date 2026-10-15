import type { FastifyInstance } from "fastify";
import {
  BoardQuery, TrackSignal, detectBounty,
  type RankedIssue, type TrackedItem, type ModelMetrics,
} from "@paydirt/shared";
import { config } from "../config.js";
import type { StoreHandle } from "../store/index.js";
import { httpOk, tcpOk } from "../probes.js";

export async function registerRoutes(app: FastifyInstance, handle: StoreHandle): Promise<void> {
  const { store, probe } = handle;

  app.get("/api/health", async () => {
    const [predictor, ollama, temporal] = await Promise.all([
      httpOk(`${config.predictorUrl}/health`),
      httpOk(`${config.ollamaUrl}/api/tags`),
      tcpOk(config.temporalAddress.split(":")[0] ?? "localhost", Number(config.temporalAddress.split(":")[1] ?? 7233)),
    ]);
    return {
      ok: true,
      db: probe.connected ? "postgres" : "memory",
      temporal,
      predictor,
      ollama,
      version: config.version,
    };
  });

  app.get("/api/issues", async (req): Promise<RankedIssue[]> => {
    const q = BoardQuery.parse(req.query);
    return store.listBoard(q);
  });

  app.get("/api/issues/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await store.getIssue(Number(id));
    if (!row) return reply.code(404).send({ error: "not_found" });
    return row;
  });

  app.get("/api/search", async (req): Promise<RankedIssue[]> => {
    const { q, k } = req.query as { q?: string; k?: string };
    if (!q) return [];
    return store.search(q, Math.min(Number(k ?? 20), 100));
  });

  app.get("/api/model", async (): Promise<ModelMetrics> => store.getModelMetrics());

  app.get("/api/track", async (): Promise<TrackedItem[]> => store.listTracked());

  app.post("/api/track", async (req, reply) => {
    const body = req.body as { issueId?: number };
    const issueId = Number(body.issueId);
    if (!Number.isFinite(issueId)) return reply.code(400).send({ error: "issueId required" });
    const created = await store.createTrack(issueId);
    if (!created) return reply.code(404).send({ error: "issue_not_found" });
    return reply.code(201).send(created);
  });

  app.post("/api/track/:id/signal", async (req, reply) => {
    const { id } = req.params as { id: string };
    const signal = TrackSignal.parse(req.body);
    const updated = await store.signalTrack(Number(id), signal);
    if (!updated) return reply.code(404).send({ error: "track_not_found" });
    return updated;
  });

  // Wired fully in Loop 7 (local Gemma); present so the UI can call them.
  app.post("/api/profile/ingest", async (_req, reply) =>
    reply.code(202).send({ queued: true, note: "profile embedding runs via Ollama when available" }));

  app.post("/api/drafts/plan", async (_req, reply) =>
    reply.code(503).send({ error: "ollama_unavailable", dryRun: config.dryRun }));

  // Convenience: show the bounty parser is real, not assumed.
  app.get("/api/parse-labels", async (req) => {
    const { labels } = req.query as { labels?: string };
    const arr = (labels ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return { labels: arr, bounty: detectBounty(arr) };
  });
}
