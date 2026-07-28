CREATE TABLE IF NOT EXISTS "admin_roles" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL UNIQUE,
  "description" text,
  "page_keys" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_role_id" varchar REFERENCES "admin_roles"("id");

CREATE INDEX IF NOT EXISTS "idx_users_admin_role_id" ON "users" ("admin_role_id");
