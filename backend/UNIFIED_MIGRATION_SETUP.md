# Unified Migration Runner — Replication Guide

Use this document to replicate the **same migration setup** in an identical project (e.g. a fork, staging clone, or second environment).

## Problem this solves

Previously, `npm run migrate` only ran **data** backfills (`shipperLoadNumber`, `pickupId`) and did **not** execute the SQL files in `backend/migrations/`. Schema changes (`0001`–`0008`) had to be applied manually or via one-off scripts.

After this change, **`npm run migrate` runs everything**:

1. **Step 1 — Schema migrations:** all `backend/migrations/*.sql` files in sorted order
2. **Step 2 — Data migrations:** existing TypeScript backfills in `storage.runDataMigration()`

---

## Files to add or change

| Action | Path |
|--------|------|
| **Add** | `backend/scripts/schema-migrations.ts` |
| **Update** | `backend/scripts/run-migration.ts` |
| **Update** | `backend/src/storage.ts` (`runDataMigration` signature) |
| **Update** | `backend/package.json` (scripts) |
| **No change required** | `backend/docker-entrypoint.sh` (already calls `npm run migrate`) |
| **Keep** | All SQL files in `backend/migrations/` |

---

## Step 1 — Add `backend/scripts/schema-migrations.ts`

Create this new file. It is the core runner.

**Responsibilities:**

- Reads every `*.sql` file from `backend/migrations/`, sorted lexically (`0000`, `0001`, …)
- Creates a tracking table `schema_migrations` if missing
- Skips files already recorded in `schema_migrations`
- **Bootstraps legacy databases:** if `schema_migrations` is empty but tables/columns already exist, marks those files as applied without re-running them (safe for production RDS that was migrated manually)
- Splits Drizzle-generated SQL on `--> statement-breakpoint` (required for `0000_confused_the_liberteens.sql`)
- Uses SSL for RDS (`DATABASE_URL` contains `rds.amazonaws.com` or `DB_SSL=true`)
- Throws on failure (no silent success)

Copy the full file from this repo:

```
backend/scripts/schema-migrations.ts
```

### Bootstrap checks (customize per project)

When replicating in another project, update `BOOTSTRAP_CHECKS` in `schema-migrations.ts` whenever you add a new numbered migration. Each entry maps a filename to a SQL `EXISTS` query that detects whether that migration was already applied manually.

Current mappings in this project:

| Migration file | Bootstrap detection |
|----------------|---------------------|
| `0000_confused_the_liberteens.sql` | `users` table exists |
| `0001_intutrack_trips.sql` | `trips` table exists |
| `0002_surepass_kyc.sql` | `surepass_kyc_requests` table exists |
| `0003_triptrack_load.sql` | `loads.triptrack_id` column exists |
| `0004_otp_verifications_rate_limit_idx.sql` | index `idx_otp_verifications_phone_type_created` exists |
| `0005_saved_addresses_shipper_id_varchar.sql` | `saved_addresses.shipper_id` is `varchar` |
| `0006_physical_pod_submitted.sql` | `shipments.physical_pod_submitted_at` column exists |
| `0007_finance_review_advance_payment.sql` | `finance_reviews.advance_payment_released_at` column exists |
| `0008_driver_user_accounts.sql` | `drivers.user_id` column exists |
| `0009_rc_expiry.sql` | `trucks.rc_expiry` column exists |
| `0010_session_table_primary_key.sql` | `session` table has a `PRIMARY KEY` |

**When adding `0011_*.sql`:** add a matching bootstrap check so existing databases are not broken on first deploy.

---

## Step 2 — Update `backend/scripts/run-migration.ts`

Replace the body so it runs schema migrations first, then data migrations, and **exits with code 1 on failure**.

```typescript
import "dotenv/config";
import { storage } from "../src/storage";
import { runSchemaMigrations } from "./schema-migrations";

async function runMigration() {
  console.log("=".repeat(60));
  console.log("Starting Database Migration");
  console.log("=".repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);
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
```

---

## Step 3 — Update `backend/src/storage.ts`

Change `runDataMigration` so the CLI can fail hard, while app startup still tolerates errors.

**Before:**

```typescript
async runDataMigration(): Promise<void> {
  // ...
  } catch (error) {
    console.error("[Migration] Error during data migration:", error);
    // Don't throw - let the app continue even if migration fails
  }
}
```

**After:**

```typescript
async runDataMigration(options: { throwOnError?: boolean } = {}): Promise<void> {
  const { throwOnError = false } = options;
  // ...
  } catch (error) {
    console.error("[Migration] Error during data migration:", error);
    if (throwOnError) throw error;
  }
}
```

`index.ts` still calls `storage.runDataMigration().catch(...)` on startup — behavior unchanged for the running app. Only `npm run migrate` passes `{ throwOnError: true }`.

---

## Step 4 — Update `backend/package.json` scripts

```json
{
  "scripts": {
    "migrate": "tsx --env-file=.env scripts/run-migration.ts",
    "migrate:0003-triptrack": "npm run migrate",
    "migrate:0005-saved-addresses": "npm run migrate"
  }
}
```

The per-migration scripts now delegate to the unified runner. You can remove the old standalone scripts (`run-0003-triptrack-load.ts`, `run-0005-saved-addresses-shipper-id.ts`) once verified, or keep them for reference.

---

## Step 5 — SQL migrations directory

Ensure all schema files live under:

```
backend/migrations/
  0000_confused_the_liberteens.sql
  0001_intutrack_trips.sql
  0002_surepass_kyc.sql
  0003_triptrack_load.sql
  0004_otp_verifications_rate_limit_idx.sql
  0005_saved_addresses_shipper_id_varchar.sql
  0006_physical_pod_submitted.sql
  0007_finance_review_advance_payment.sql
  0008_driver_user_accounts.sql
  0009_rc_expiry.sql
  0010_session_table_primary_key.sql
```

**Naming rule:** use a zero-padded numeric prefix so lexical sort matches apply order.

**Drizzle files:** keep `--> statement-breakpoint` markers; the runner splits on them.

**Idempotency:** prefer `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc. in new migrations so re-runs are safe during development.

---

## Step 6 — ECS / Docker (no code change)

`backend/docker-entrypoint.sh` already runs migrations before the app starts:

```sh
echo "Running database migrations..."
if npm run migrate; then
  echo "Migrations completed successfully!"
else
  echo "Migration failed, but continuing..."
fi
```

On deploy, ECS will automatically apply pending schema + data migrations.

> **Note:** The entrypoint currently continues even if migrate fails. For stricter production behavior, change the `else` branch to `exit 1`.

---

## How to add a new migration

1. Create `backend/migrations/0011_your_change.sql`
2. Add a bootstrap check in `BOOTSTRAP_CHECKS` inside `schema-migrations.ts`
3. Run locally: `cd backend && npm run migrate`
4. Commit both the `.sql` file and the bootstrap entry
5. Deploy — ECS entrypoint runs migrate on container start

---

## Verification

### Local

```bash
cd backend
npm run migrate
```

**Expected output (first run on fresh DB):**

```
--- Step 1: Schema migrations (backend/migrations/*.sql) ---
[Schema] Pending migrations: 0000_confused_the_liberteens.sql, ...
[Schema] Applying 0000_confused_the_liberteens.sql (N statement(s))...
[Schema] ✅ 0000_confused_the_liberteens.sql
...
--- Step 2: Data migrations ---
[Migration] Data migration complete
✅ Migration completed successfully
```

**Expected output (already up to date):**

```
[Schema] All migrations already applied
--- Step 2: Data migrations ---
[Migration] Data migration complete
✅ Migration completed successfully
```

### Database

```sql
SELECT filename, applied_at
FROM schema_migrations
ORDER BY filename;
```

Should list every applied `*.sql` file.

### Production (ECS)

Check CloudWatch logs for the container startup:

```
Running database migrations...
--- Step 1: Schema migrations (backend/migrations/*.sql) ---
...
Migrations completed successfully!
```

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DB_SSL` | Optional | Set to `true` to force SSL (also auto-enabled for `rds.amazonaws.com`) |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `password authentication failed` | Wrong `DATABASE_URL` in `.env` | Fix credentials |
| `relation "users" already exists` on `0000` | DB has schema but no `schema_migrations` row | Bootstrap should mark `0000` applied; verify `users` table exists |
| Migration fails mid-file | SQL error in one statement | Check logs for `Failed 000X_... statement N/M` |
| `npm run migrate` succeeds but schema unchanged | Old code without `schema-migrations.ts` | Copy files from this guide |
| App starts but migrate errors ignored | `docker-entrypoint.sh` continues on failure | Check logs; consider `exit 1` on migrate failure |

---

## Quick replication checklist

Copy to the identical project in this order:

- [ ] Copy `backend/scripts/schema-migrations.ts`
- [ ] Update `backend/scripts/run-migration.ts`
- [ ] Update `storage.runDataMigration()` in `backend/src/storage.ts`
- [ ] Update `backend/package.json` migrate scripts
- [ ] Copy all `backend/migrations/*.sql` files
- [ ] Adjust `BOOTSTRAP_CHECKS` if migration filenames differ
- [ ] Set `DATABASE_URL` in `.env`
- [ ] Run `npm run migrate` locally and verify `schema_migrations` table
- [ ] Deploy and confirm ECS logs show Step 1 + Step 2

---

## Related docs

- `backend/MIGRATION_SETUP.md` — ECS deployment and health-check notes
- `SESSION_TABLE_FIX.md` — session table / `0008` context
- `drizzle.config.ts` — Drizzle Kit config (`db:push` is separate from `npm run migrate`)
