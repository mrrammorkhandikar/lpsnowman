#!/usr/bin/env tsx
/**
 * Database Migration Script
 *
 * Runs schema migrations (backend/migrations/*.sql) then data backfills.
 *
 * Usage:
 *   npm run migrate
 */

import "dotenv/config";
import { storage } from "../src/storage";
import { runSchemaMigrations } from "./schema-migrations";

async function runMigration() {
  console.log("=".repeat(60));
  console.log("Starting Database Migration");
  console.log("=".repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Database: ${process.env.DATABASE_URL?.split("@")[1] || "unknown"}`);
  console.log("");

  try {
    console.log("--- Step 1: Schema migrations (backend/migrations/*.sql) ---");
    await runSchemaMigrations();

    console.log("");
    console.log("--- Step 2: Data migrations ---");
    await storage.runDataMigration({ throwOnError: true });

    console.log("");
    console.log("=".repeat(60));
    console.log("✅ Migration completed successfully");
    console.log("=".repeat(60));
    process.exit(0);
  } catch (error) {
    console.error("");
    console.error("=".repeat(60));
    console.error("❌ Migration failed");
    console.error("=".repeat(60));
    console.error(error);
    process.exit(1);
  }
}

runMigration();
