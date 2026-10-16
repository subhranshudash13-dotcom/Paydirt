// Temporal worker bootstrap (PRD §8). Requires a reachable Temporal server
// (`make up` starts the dev server in Docker). Run with `npm run start -w @paydirt/worker`.
import { fileURLToPath } from "node:url";
import { NativeConnection, Worker, type ActivityInterceptors } from "@temporalio/worker";
import * as activities from "./activities.js";
import { config } from "./config.js";
import { initSentry, sentryEnabled, reportError, flush } from "./sentry.js";

// Sentry activity interceptor: capture any activity that throws, then rethrow so
// Temporal's own retry/backoff behaviour is unchanged. Only installed when Sentry
// is enabled — offline runs add zero overhead and send nothing.
function sentryActivityInterceptor(): ActivityInterceptors {
  return {
    inbound: {
      async execute(input, next) {
        try {
          return await next(input);
        } catch (err) {
          reportError(err);
          throw err;
        }
      },
    },
  };
}

async function run(): Promise<void> {
  initSentry();
  const connection = await NativeConnection.connect({ address: config.temporalAddress });
  const worker = await Worker.create({
    connection,
    namespace: config.temporalNamespace,
    taskQueue: config.taskQueue,
    workflowsPath: fileURLToPath(new URL("./workflows.js", import.meta.url)),
    activities,
    ...(sentryEnabled() ? { interceptors: { activity: [sentryActivityInterceptor] } } : {}),
  });
  console.log(`[paydirt] worker on taskQueue "${config.taskQueue}" @ ${config.temporalAddress} (ns=${config.temporalNamespace}) sentry=${sentryEnabled() ? "on" : "off"}`);
  await worker.run();
}

run().catch(async (err) => {
  reportError(err);
  await flush();
  console.error("[paydirt] worker failed to start:", err);
  process.exit(1);
});
