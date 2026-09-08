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

INSERT INTO "bc_sync_settings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;

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
