-- Link fleet drivers to login accounts (admin-provisioned drivers)
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "drivers_user_id_unique" ON "drivers" ("user_id") WHERE "user_id" IS NOT NULL;
