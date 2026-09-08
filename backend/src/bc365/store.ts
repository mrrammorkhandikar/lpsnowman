import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { bcLoadMaps, bcSyncRuns, bcSyncSettings } from "@shared/schema";

let schemaReady: Promise<void> | null = null;

export async function ensureBc365Schema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "bc_sync_settings" (
          "id" varchar PRIMARY KEY DEFAULT 'default' NOT NULL,
          "company_id" text,
          "company_name" text,
          "customer_number" text,
          "last_push_at" timestamp,
          "last_pull_at" timestamp,
          "last_wipe_at" timestamp,
          "last_error" text,
          "updated_at" timestamp DEFAULT now()
        );
        INSERT INTO "bc_sync_settings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;
        CREATE TABLE IF NOT EXISTS "bc_load_maps" (
          "load_id" varchar PRIMARY KEY REFERENCES "loads"("id") ON DELETE CASCADE,
          "bc_order_id" text NOT NULL,
          "bc_order_number" text,
          "payload_hash" text,
          "last_pushed_at" timestamp,
          "last_error" text,
          "created_at" timestamp DEFAULT now(),
          "updated_at" timestamp DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS "bc_sync_runs" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "run_type" text NOT NULL,
          "status" text NOT NULL,
          "our_count" integer,
          "synced_count" integer,
          "mismatched_count" integer,
          "missing_on_bc" integer,
          "extra_on_bc" integer,
          "error_count" integer,
          "details" jsonb,
          "started_at" timestamp DEFAULT now(),
          "finished_at" timestamp,
          "started_by" varchar REFERENCES "users"("id")
        );
        CREATE INDEX IF NOT EXISTS "idx_bc_load_maps_bc_order_id" ON "bc_load_maps" ("bc_order_id");
        CREATE INDEX IF NOT EXISTS "idx_bc_sync_runs_started_at" ON "bc_sync_runs" ("started_at");
      `);
    })();
  }
  await schemaReady;
}

export async function getBcSettings() {
  await ensureBc365Schema();
  const [row] = await db.select().from(bcSyncSettings).where(eq(bcSyncSettings.id, "default"));
  if (row) return row;
  const [created] = await db.insert(bcSyncSettings).values({ id: "default" }).returning();
  return created;
}

export async function updateBcSettings(
  updates: Partial<typeof bcSyncSettings.$inferInsert>,
) {
  await ensureBc365Schema();
  const [row] = await db
    .update(bcSyncSettings)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(bcSyncSettings.id, "default"))
    .returning();
  if (row) return row;
  const [created] = await db
    .insert(bcSyncSettings)
    .values({ id: "default", ...updates })
    .returning();
  return created;
}

export async function getBcLoadMap(loadId: string) {
  await ensureBc365Schema();
  const [row] = await db.select().from(bcLoadMaps).where(eq(bcLoadMaps.loadId, loadId));
  return row;
}

export async function getAllBcLoadMaps() {
  return db.select().from(bcLoadMaps);
}

export async function upsertBcLoadMap(values: {
  loadId: string;
  bcOrderId: string;
  bcOrderNumber?: string | null;
  payloadHash?: string | null;
  lastError?: string | null;
}) {
  const existing = await getBcLoadMap(values.loadId);
  if (existing) {
    const [row] = await db
      .update(bcLoadMaps)
      .set({
        bcOrderId: values.bcOrderId,
        bcOrderNumber: values.bcOrderNumber ?? existing.bcOrderNumber,
        payloadHash: values.payloadHash ?? existing.payloadHash,
        lastError: values.lastError ?? null,
        lastPushedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bcLoadMaps.loadId, values.loadId))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(bcLoadMaps)
    .values({
      loadId: values.loadId,
      bcOrderId: values.bcOrderId,
      bcOrderNumber: values.bcOrderNumber,
      payloadHash: values.payloadHash,
      lastError: values.lastError ?? null,
      lastPushedAt: new Date(),
    })
    .returning();
  return row;
}

export async function deleteBcLoadMap(loadId: string) {
  await ensureBc365Schema();
  await db.delete(bcLoadMaps).where(eq(bcLoadMaps.loadId, loadId));
}

export async function clearBcLoadMaps() {
  await ensureBc365Schema();
  await db.delete(bcLoadMaps);
}

export async function insertBcSyncRun(values: typeof bcSyncRuns.$inferInsert) {
  await ensureBc365Schema();
  const [row] = await db.insert(bcSyncRuns).values(values).returning();
  return row;
}

export async function updateBcSyncRun(
  id: string,
  updates: Partial<typeof bcSyncRuns.$inferInsert>,
) {
  await ensureBc365Schema();
  const [row] = await db
    .update(bcSyncRuns)
    .set(updates)
    .where(eq(bcSyncRuns.id, id))
    .returning();
  return row;
}

export async function listRecentBcSyncRuns(limit = 10) {
  await ensureBc365Schema();
  const { desc } = await import("drizzle-orm");
  return db.select().from(bcSyncRuns).orderBy(desc(bcSyncRuns.startedAt)).limit(limit);
}
