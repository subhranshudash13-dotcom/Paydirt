// Sentry error reporting (sponsor: Sentry) for the Temporal worker. Init is gated
// on SENTRY_DSN: with no DSN every helper is a no-op and the worker runs fully
// offline — we never pretend telemetry was delivered.
import * as Sentry from "@sentry/node";
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
    environment: process.env.NODE_ENV ?? "development",
    release: `paydirt-worker@${config.version}`,
    tracesSampleRate: 0.2,
  });
  enabled = true;
  return true;
}

export function sentryEnabled(): boolean {
  return enabled;
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
