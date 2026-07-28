-- Fix session table for connect-pg-simple: ensure PRIMARY KEY on sid.
-- Without it, sessions are written but not reliably loaded (userId stays undefined).
-- If the table already exists without a PK, it is recreated and active sessions are cleared.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'session'
  ) THEN
    CREATE TABLE "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
    CREATE INDEX "IDX_session_expire" ON "session" ("expire");
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'session'
      AND constraint_type = 'PRIMARY KEY'
  ) THEN
    DROP TABLE "session";
    CREATE TABLE "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
    CREATE INDEX "IDX_session_expire" ON "session" ("expire");
  ELSE
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  END IF;
END $$;
