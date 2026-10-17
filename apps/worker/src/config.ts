import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env without a dependency (Node 21+ has process.loadEnvFile). Same
// pattern as apps/api so config stays consistent across the monorepo.
try {
  const envPath = resolve(process.cwd(), ".env");
  const rootEnv = resolve(process.cwd(), "../../.env");
  const pick = existsSync(envPath) ? envPath : existsSync(rootEnv) ? rootEnv : null;
  if (pick) process.loadEnvFile(pick);
} catch {
  /* env file optional — blank keys run in offline/demo mode */
}

const bool = (v: string | undefined, d = false): boolean =>
  v === undefined ? d : ["1", "true", "yes", "on"].includes(v.toLowerCase());

export const config = {
  temporalAddress: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  temporalNamespace: process.env.TEMPORAL_NAMESPACE ?? "default",
  taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? "paydirt",
  databaseUrl: process.env.DATABASE_URL ?? "",
  get predictorUrl(): string {
    return process.env.PREDICTOR_URL ?? "http://localhost:8000";
  },
  ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
  gemmaChatModel: process.env.GEMMA_CHAT_MODEL ?? "gemma3:4b",
  gemmaEmbedModel: process.env.GEMMA_EMBED_MODEL ?? "embeddinggemma",
  githubToken: process.env.GITHUB_TOKEN ?? "",
  serpapiKey: process.env.SERPAPI_KEY ?? "",
  sentryDsn: process.env.SENTRY_DSN ?? "",
  dryRun: bool(process.env.DRY_RUN, true),
  discoveryIntervalHours: Number(process.env.DISCOVERY_INTERVAL_HOURS ?? 6),
  followUpDays: Number(process.env.FOLLOW_UP_DAYS ?? 5),
  abandonAfterDays: Number(process.env.ABANDON_AFTER_DAYS ?? 14),
  version: "0.1.0",
} as const;

export type Config = typeof config;
