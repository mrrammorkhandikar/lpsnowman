import type { Pool } from "pg";

const SESSION_DDL = `
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`;

/**
 * Ensures connect-pg-simple's table exists before any session INSERT.
 * Previously this ran fire-and-forget, so the first login/register could block
 * behind DDL or race the CREATE, causing multi-second delays in production.
 */
export async function ensureSessionStoreTable(pool: Pool): Promise<void> {
  await pool.query(SESSION_DDL);
}

/**
 * Opens several pool connections up front AND warms the exact tables used by
 * every login/register so RDS has query-plan cache hits for the first real user.
 *
 * SELECT 1 alone does not exercise the ORM or any table — it hits the DB but
 * leaves the users / session tables cold.  Running lightweight reads against
 * those tables causes RDS to cache execution plans, buffer-pool pages, and
 * index blocks so the first auth request is as fast as subsequent ones.
 */
export async function warmDatabasePool(
  pool: Pool,
  connections = 4,
): Promise<void> {
  const n = Math.max(
    1,
    Number.parseInt(process.env.DB_POOL_WARMUP_CONNECTIONS || String(connections), 10) || connections,
  );

  // Open the requested number of connections in parallel (TCP+TLS cost paid now, not on first user request)
  await Promise.all(Array.from({ length: n }, () => pool.query("SELECT 1")));

  // Warm the auth-path tables so RDS caches query plans + index pages for login
  await Promise.all([
    pool.query("SELECT id FROM users LIMIT 1").catch(() => {}),
    pool.query('SELECT sid FROM "session" LIMIT 1').catch(() => {}),
  ]);
}

/**
 * Starts a recurring lightweight ping that keeps the minimum pool connections
 * alive during quiet periods.  Without this, idle connections close after
 * idleTimeoutMillis and the next request re-pays connection setup cost.
 *
 * Interval defaults to 4 minutes (well below any 10-minute idle cut-off).
 * Override with DB_KEEPALIVE_INTERVAL_MS env var.
 */
export function startPoolKeepAlive(pool: Pool): void {
  const intervalMs = Number.parseInt(
    process.env.DB_KEEPALIVE_INTERVAL_MS || "240000",
    10,
  );
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;

  setInterval(() => {
    pool.query("SELECT 1").catch(() => {});
  }, intervalMs);
}
