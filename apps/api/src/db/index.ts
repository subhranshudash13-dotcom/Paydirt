import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

export interface DbProbe {
  pool: pg.Pool | null;
  connected: boolean;
  reason?: string;
}

/** Connect once at startup; if Postgres/Tiger Data isn't reachable we fall back to memory. */
export async function probeDb(): Promise<DbProbe> {
  if (!config.databaseUrl) return { pool: null, connected: false, reason: "DATABASE_URL unset" };
  const pool = new Pool({ connectionString: config.databaseUrl, max: 10, connectionTimeoutMillis: 3000 });
  try {
    await pool.query("SELECT 1");
    return { pool, connected: true };
  } catch (e) {
    await pool.end().catch(() => {});
    return { pool: null, connected: false, reason: (e as Error).message };
  }
}
