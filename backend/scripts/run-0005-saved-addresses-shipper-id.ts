#!/usr/bin/env node
/**
 * Run migration 0005_saved_addresses_shipper_id_varchar.sql manually.
 * Alters saved_addresses.shipper_id from integer to varchar to match the UUID user id.
 * Usage: npx tsx scripts/run-0005-saved-addresses-shipper-id.ts
 */
import { Client } from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const statements = [
  `ALTER TABLE "saved_addresses" ALTER COLUMN "shipper_id" TYPE varchar USING "shipper_id"::varchar`,
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
  console.log("✅ 0005_saved_addresses_shipper_id_varchar.sql applied.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
