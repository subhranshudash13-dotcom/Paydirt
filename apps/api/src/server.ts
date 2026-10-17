import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { createStore } from "./store/index.js";
import { registerRoutes } from "./routes/index.js";
import { hydrate } from "./live/hydrate.js";
import { initSentry, sentryEnabled, attachFastifyErrorHandler, reportError, flush } from "./sentry.js";

export async function buildApp() {
  initSentry();
  const app = Fastify({ logger: true });
  attachFastifyErrorHandler(app);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const configured = config.corsOrigin.split(",").map((s) => s.trim());
      if (
        config.corsOrigin === "*" ||
        configured.includes("*") ||
        configured.includes(origin) ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return cb(null, true);
      }
      return cb(null, true);
    },
    credentials: true,
  });
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
  // Make the board dynamic: attach the sidecar predictor + try a live GitHub feed.
  // Runs off the critical path so startup never blocks on rate-limited network.
  hydrate(handle.store)
    .then((feed) => {
      handle.feed = feed;
      app.log.info(`board feed = ${feed.source} · model = ${feed.modelVersion} · issues = ${feed.count}`);
    })
    .catch((err: Error) => app.log.warn(`live hydrate skipped (${err.message}) → seed + heuristic`));
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
