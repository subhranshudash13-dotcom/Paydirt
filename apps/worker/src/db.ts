// Lazy Postgres pool for worker activities. No DATABASE_URL => null => activities
// run in a "would-persist" mode (returns counts, touches no DB) so discovery is
// still demoable end-to-end on machines without a database (matches the API's
// memory/postgres dual driver philosophy, PRD §5).
import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;
let pool: pg.Pool | null = null;

export function db(): pg.Pool | null {
  if (!config.databaseUrl) return null;
  if (!pool) pool = new Pool({ connectionString: config.databaseUrl, max: 4 });
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
