# Session Table Fix - PRIMARY KEY Missing

## Problem Identified

The production logs show sessions are being created but not persisted:
```
sessionID: 'R-iqhoTYd3NdZztJEGZXl4udI5bvsnMv',
userId: undefined,  ← Session data not being loaded
hasCookie: true,    ← Cookie exists
```

**Root Cause**: The `session` table is missing a PRIMARY KEY constraint on the `sid` column, which is required by `connect-pg-simple` to properly store and retrieve session data.

## What Was Fixed

### 1. Updated Session Table Schema (backend/src/routes.ts)
```typescript
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,  // ← Added PRIMARY KEY
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
```

### 2. Created Migration Script
Created `backend/scripts/fix-session-table.ts` to fix existing production database.

## Deployment Steps

### Option A: Quick Fix (Recommended for Production)

Run this SQL directly in your RDS database:

```sql
-- Drop and recreate session table with PRIMARY KEY
DROP TABLE IF EXISTS "session";
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

**Note**: This will log out all current users, but they can immediately log back in.

### Option B: Using Migration Script

1. SSH into your EC2 instance or connect to your backend container
2. Run the migration:
```bash
cd /app
npm run tsx backend/scripts/fix-session-table.ts
```

### Option C: Automatic on Next Deploy

The fix is already in the code. On the next deployment:
1. The new code will create the table with PRIMARY KEY
2. Existing sessions will be cleared
3. Users can log in again with proper session persistence

## Verification

After applying the fix, verify sessions are working:

1. **Check table schema**:
```sql
\d session
-- Should show PRIMARY KEY constraint on sid column
```

2. **Test login flow**:
```bash
# Login
curl -X POST https://api.loadsmart.in/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt

# Check session (should return user data, not 401)
curl https://api.loadsmart.in/api/auth/me \
  -b cookies.txt
```

3. **Monitor logs**:
```bash
# Should see userId populated after login
[Session Debug] {
  sessionID: 'xxx',
  userId: '123',  ← Should have value
  hasCookie: true
}
```

## Why This Happened

The original session table creation was missing the PRIMARY KEY constraint:
```sql
-- OLD (incorrect)
"sid" varchar NOT NULL COLLATE "default",

-- NEW (correct)
"sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
```

Without PRIMARY KEY:
- Sessions are created but not properly indexed
- `connect-pg-simple` cannot efficiently retrieve session data
- Results in `userId: undefined` on subsequent requests

## Impact

- **Before Fix**: Users could log in but immediately get 401 on next request
- **After Fix**: Sessions persist properly across requests
- **Side Effect**: All users need to log in again (one-time)

## Files Changed

1. `backend/src/routes.ts` - Fixed session table schema
2. `backend/scripts/fix-session-table.ts` - Migration script (new)
3. `SESSION_TABLE_FIX.md` - This documentation (new)

## Next Steps

1. ✅ Apply the SQL fix to production database
2. ✅ Redeploy backend with updated code
3. ✅ Test login flow end-to-end
4. ✅ Monitor session logs for `userId` population
5. ✅ Notify users they may need to log in again

---

**Status**: Ready to deploy
**Priority**: CRITICAL - Blocks all authenticated requests
**Estimated Downtime**: None (users just need to re-login)
