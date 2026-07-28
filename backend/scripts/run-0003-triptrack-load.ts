#!/usr/bin/env node
/**
 * Run migration 0003_triptrack_load.sql manually.
 * Usage: npx tsx scripts/run-0003-triptrack-load.ts
 * Or from backend: node -e "..." with pg (see README)
 */
import { Client } from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const statements = [
  `ALTER TABLE "loads" ADD COLUMN IF NOT EXISTS "triptrack_id" text`,
  `ALTER TABLE "loads" ADD COLUMN IF NOT EXISTS "triptrack_map" text`,
  `ALTER TABLE "loads" ADD COLUMN IF NOT EXISTS "triptrack_locations" jsonb`,
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Set it in backend/.env");
    process.exit(1);
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  for (const statement of statements) {
    console.log("Running:", statement);
    await client.query(statement);
  }
  console.log("✅ 0003_triptrack_load.sql applied.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
