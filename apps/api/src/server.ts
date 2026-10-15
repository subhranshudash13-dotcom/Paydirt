import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { createStore } from "./store/index.js";
import { registerRoutes } from "./routes/index.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
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
  app
    .listen({ port: config.port, host: "0.0.0.0" })
    .then(() => app.log.info(`Paydirt API on :${config.port}`))
    .catch((err: Error) => {
      app.log.error(err);
      process.exit(1);
    });
}
