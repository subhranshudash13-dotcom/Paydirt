// Temporal worker bootstrap (PRD §8). Requires a reachable Temporal server
// (`make up` starts the dev server in Docker). Run with `npm run start -w @paydirt/worker`.
import { fileURLToPath } from "node:url";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities.js";
import { config } from "./config.js";

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({ address: config.temporalAddress });
  const worker = await Worker.create({
    connection,
    namespace: config.temporalNamespace,
    taskQueue: config.taskQueue,
    workflowsPath: fileURLToPath(new URL("./workflows.js", import.meta.url)),
    activities,
  });
  console.log(`[paydirt] worker on taskQueue "${config.taskQueue}" @ ${config.temporalAddress} (ns=${config.temporalNamespace})`);
  await worker.run();
}

run().catch((err) => {
  console.error("[paydirt] worker failed to start:", err);
  process.exit(1);
});
