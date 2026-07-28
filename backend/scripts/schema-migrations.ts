import fs from "fs";
import path from "path";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

/**
 * Maps each migration file to a SQL query that returns a single boolean column `exists`.
 * Used to mark migrations as already applied on legacy databases that were migrated manually.
 */
const BOOTSTRAP_CHECKS: Record<string, string> = {
  "0000_confused_the_liberteens.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists
  `,
  "0001_intutrack_trips.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'trips'
    ) AS exists
  `,
  "0002_surepass_kyc.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'surepass_kyc_requests'
    ) AS exists
  `,
  "0003_triptrack_load.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'loads'
        AND column_name = 'triptrack_id'
    ) AS exists
  `,
  "0004_otp_verifications_rate_limit_idx.sql": `
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_otp_verifications_phone_type_created'
    ) AS exists
  `,
  "0005_saved_addresses_shipper_id_varchar.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'saved_addresses'
        AND column_name = 'shipper_id'
        AND data_type = 'character varying'
    ) AS exists
  `,
  "0006_physical_pod_submitted.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'shipments'
        AND column_name = 'physical_pod_submitted_at'
    ) AS exists
  `,
  "0007_finance_review_advance_payment.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'finance_reviews'
        AND column_name = 'advance_payment_released_at'
    ) AS exists
  `,
  "0008_driver_user_accounts.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'drivers'
        AND column_name = 'user_id'
    ) AS exists
  `,
  "0009_rc_expiry.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trucks'
        AND column_name = 'rc_expiry'
    ) AS exists
  `,
  "0010_session_table_primary_key.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'session'
        AND constraint_type = 'PRIMARY KEY'
    ) AS exists
  `,
  "0011_admin_roles.sql": `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admin_roles'
    ) AS exists
  `,
};

function getMigrationsDir(): string {
  return path.join(process.cwd(), "migrations");
}

function listMigrationFiles(): string[] {
  const dir = getMigrationsDir();
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function splitStatements(content: string): string[] {
  if (content.includes("--> statement-breakpoint")) {
    return content
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
  }
  const trimmed = content.trim();
  return trimmed ? [trimmed] : [];
}

function createPool(): pg.Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set");
  }
  const useSsl =
    databaseUrl.includes("rds.amazonaws.com") || process.env.DB_SSL === "true";
  return new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 1,
  });
}

async function ensureMigrationTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename varchar PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(pool: pg.Pool): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations",
  );
  return new Set(result.rows.map((row) => row.filename));
}

async function markMigrationApplied(
  pool: pg.Pool,
  filename: string,
): Promise<void> {
  await pool.query(
    "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
    [filename],
  );
}

async function isBootstrapApplied(
  pool: pg.Pool,
  filename: string,
): Promise<boolean> {
  const check = BOOTSTRAP_CHECKS[filename];
  if (!check) return false;
  const result = await pool.query<{ exists: boolean }>(check);
  return Boolean(result.rows[0]?.exists);
}

async function applyMigrationFile(
  pool: pg.Pool,
  filename: string,
): Promise<void> {
  const filePath = path.join(getMigrationsDir(), filename);
  const content = fs.readFileSync(filePath, "utf8");
  const statements = splitStatements(content);

  console.log(
    `[Schema] Applying ${filename} (${statements.length} statement(s))...`,
  );

  const client = await pool.connect();
  try {
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
      } catch (error) {
        throw new Error(
          `Failed ${filename} statement ${i + 1}/${statements.length}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    await markMigrationApplied(pool, filename);
    console.log(`[Schema] ✅ ${filename}`);
  } finally {
    client.release();
  }
}

export async function runSchemaMigrations(): Promise<void> {
  const pool = createPool();
  try {
    await ensureMigrationTable(pool);
    const applied = await getAppliedMigrations(pool);
    const files = listMigrationFiles();
    const pending = files.filter((file) => !applied.has(file));

    if (pending.length === 0) {
      console.log("[Schema] All migrations already applied");
      return;
    }

    console.log(`[Schema] Pending migrations: ${pending.join(", ")}`);

    for (const filename of pending) {
      if (await isBootstrapApplied(pool, filename)) {
        console.log(`[Schema] Bootstrap: ${filename} already applied — marking`);
        await markMigrationApplied(pool, filename);
        continue;
      }
      await applyMigrationFile(pool, filename);
    }
  } finally {
    await pool.end();
  }
}
