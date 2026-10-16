// Sentry error reporting (sponsor: Sentry). Init is gated on SENTRY_DSN so the
// project still runs in offline/demo mode: with no DSN every helper is a no-op
// and nothing is sent anywhere — we never pretend telemetry was delivered.
import * as Sentry from "@sentry/node";
import type { FastifyInstance } from "fastify";
import { config } from "./config.js";

let enabled = false;

/** Initialise Sentry from config. Returns whether reporting is actually on. */
export function initSentry(): boolean {
  if (!config.sentryDsn) {
    enabled = false;
    return false;
  }
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.env,
    release: `paydirt-api@${config.version}`,
    tracesSampleRate: 0.2,
  });
  enabled = true;
  return true;
}

/** True only when a DSN was present and Sentry.init ran. */
export function sentryEnabled(): boolean {
  return enabled;
}

/** Attach Fastify's request-error → Sentry capture. No-op when disabled. */
export function attachFastifyErrorHandler(app: FastifyInstance): void {
  if (enabled) Sentry.setupFastifyErrorHandler(app);
}

/** Report a caught error. No-op when disabled. */
export function reportError(err: unknown): void {
  if (enabled) Sentry.captureException(err);
}

/** Best-effort flush before process exit so pending events are delivered. */
export async function flush(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    /* never let telemetry teardown crash shutdown */
  }
}
