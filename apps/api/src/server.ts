import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { createStore } from "./store/index.js";
import { registerRoutes } from "./routes/index.js";
import { initSentry, sentryEnabled, attachFastifyErrorHandler, reportError, flush } from "./sentry.js";

export async function buildApp() {
  initSentry();
  const app = Fastify({ logger: true });
  attachFastifyErrorHandler(app);
  await app.register(cors, { origin: config.corsOrigin });
  const handle = await createStore();
  await registerRoutes(app, handle);
  app.addHook("onClose", async () => {
    await handle.probe.pool?.end();
  });
  return { app, handle };
}

const isMain = process.argv[1]?.includes("server");
if (isMain) {
  const { app, handle } = await buildApp();
  app.log.info(`data driver = ${handle.store.driver}`);
  app.log.info(`sentry error reporting = ${sentryEnabled() ? "on" : "off (no SENTRY_DSN)"}`);
  app
    .listen({ port: config.port, host: "0.0.0.0" })
    .then(() => app.log.info(`Paydirt API on :${config.port}`))
    .catch(async (err: Error) => {
      reportError(err);
      await flush();
      app.log.error(err);
      process.exit(1);
    });
}
