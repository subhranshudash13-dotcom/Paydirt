import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "../config.js";

async function main(): Promise<void> {
  if (!config.databaseUrl) {
    console.error("DATABASE_URL is not set — cannot migrate.");
    process.exit(1);
  }
  const here = dirname(fileURLToPath(import.meta.url));
  // Walk up to find db/migrations whether run from src/ (tsx) or dist/ (node).
  let dir = resolve(here, "../../../../db/migrations");
  if (!existsSync(dir)) dir = resolve(here, "../../../db/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(resolve(dir, file), "utf8");
    console.log(`applying ${file} …`);
    await client.query(sql);
  }
  await client.end();
  console.log(`✓ ${files.length} migrations applied`);
}

main().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
