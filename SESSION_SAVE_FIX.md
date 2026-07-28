# Critical Session Save Fix

## Problem Identified from Logs

Your production logs show:
```
sessionID: '0ith8Y-Xlw7__8XYOKDpNHcuW9-7MW7A',
userId: undefined,  ← SESSION EXISTS BUT NO USER ID
hasCookie: true,
origin: undefined,
```

This means:
- ✅ Session is being created
- ✅ Cookies are being sent
- ❌ **User ID is not being saved to the session**
- ❌ Origin header is missing (CORS issue)

## Root Cause

The login and register endpoints were setting `req.session.userId = user.id` but **not explicitly saving the session** before sending the response. 

In production with PostgreSQL session store, sessions need to be explicitly saved to ensure the data is persisted to the database before the response is sent.

## Fix Applied

### 1. Login Endpoint (`/api/auth/login`)
**Before**:
```typescript
req.session.userId = user.id;
res.json({ user: { ...userWithoutPassword, carrierType } });
```

**After**:
```typescript
req.session.userId = user.id;

// CRITICAL: Save session before sending response
req.session.save((err) => {
  if (err) {
    console.error('[Login] Session save error:', err);
    return res.status(500).json({ error: "Failed to save session" });
  }
  console.log(`[Login] Session saved successfully for user ${user.id}`);
  res.json({ user: { ...userWithoutPassword, carrierType } });
});
```

### 2. Register Endpoint (`/api/auth/register`)
**Before**:
```typescript
req.session.userId = user.id;
res.json({ user: userWithoutPassword });
```

**After**:
```typescript
req.session.userId = user.id;

// CRITICAL: Save session before sending response
req.session.save((err) => {
  if (err) {
    console.error('[Register] Session save error:', err);
    return res.status(500).json({ error: "Failed to save session" });
  }
  console.log(`[Register] Session saved successfully for user ${user.id}`);
  res.json({ user: userWithoutPassword });
});
```

### 3. OTP Login Endpoint
Already had session save implemented correctly ✓

## Why This Happens

### Development (Memory Store)
- Session changes are immediately available in memory
- No explicit save needed
- Works without `req.session.save()`

### Production (PostgreSQL Store)
- Session changes need to be written to database
- Without explicit save, changes may not persist
- Race condition: Response sent before session saved
- Result: Next request has empty session

## Additional Issue: Missing Origin Header

The logs also show `origin: undefined`, which indicates CORS headers are not being sent properly. This is likely because:

1. **Frontend is not sending Origin header** - Need to verify `VITE_API_BASE_URL` is set
2. **CORS middleware not configured for production domain** - Need to verify `FRONTEND_URL` environment variable

## Complete Fix Checklist

### Backend Fixes (DONE)
- [x] Add `req.session.save()` to login endpoint
- [x] Add `req.session.save()` to register endpoint
- [x] Add error handling for session save failures
- [x] Add logging for successful session saves

### Frontend Fixes (DONE - from previous fix)
- [x] Create API client with environment-aware URLs
- [x] Update auth-context to use API client
- [x] Update queryClient to use API client
- [x] Update WebSocket connection

### Environment Configuration (TODO - YOU NEED TO DO THIS)
- [ ] Add `VITE_API_BASE_URL` GitHub secret
- [ ] Verify `COOKIE_DOMAIN` is `.loadsmart.in`
- [ ] Verify `FRONTEND_URL` is `https://www.loadsmart.in`
- [ ] Verify `SESSION_SECRET` exists

## Deployment Steps

### 1. Commit Backend Changes
```bash
git add backend/src/routes.ts
git commit -m "Fix: Add explicit session save in login/register endpoints

- Add req.session.save() callback in login endpoint
- Add req.session.save() callback in register endpoint
- Add error handling for session save failures
- Add logging for debugging session persistence

This ensures userId is persisted to PostgreSQL session store
before response is sent, fixing the 'userId: undefined' issue
in production."
```

### 2. Add GitHub Secret (CRITICAL)
Go to: Repository → Settings → Secrets and variables → Actions

Add:
- **Name**: `VITE_API_BASE_URL`
- **Value**: `https://api.loadsmart.in`

### 3. Deploy
```bash
git push origin prod
```

### 4. Monitor Logs
After deployment, check CloudWatch logs for:
```
[Login] Session saved successfully for user <user-id>
```

### 5. Test
1. Login at https://www.loadsmart.in
2. Check browser console - should see no errors
3. Refresh page - should stay logged in
4. Check backend logs - should see `userId: <actual-id>` instead of `undefined`

## Expected Log Output After Fix

### Before (Current - Broken)
```
[Session Debug] {
  sessionID: '0ith8Y-Xlw7__8XYOKDpNHcuW9-7MW7A',
  userId: undefined,  ← PROBLEM
  hasCookie: true,
  origin: undefined,
  path: '/api/bids'
}
GET /api/bids 401 in 2ms :: {"error":"Unauthorized"}
```

### After (Expected - Fixed)
```
[Login] Session saved successfully for user 123
[Session Debug] {
  sessionID: '0ith8Y-Xlw7__8XYOKDpNHcuW9-7MW7A',
  userId: '123',  ← FIXED
  hasCookie: true,
  origin: 'https://www.loadsmart.in',
  path: '/api/bids'
}
GET /api/bids 200 in 5ms :: [bid data]
```

## Why This Fix Works

1. **Explicit Save**: `req.session.save()` forces immediate write to PostgreSQL
2. **Callback Pattern**: Response only sent after session is confirmed saved
3. **Error Handling**: If save fails, user gets error instead of broken session
4. **Logging**: Can verify in logs that session save succeeded

## Testing Checklist

After deployment:
- [ ] Login works
- [ ] User data displays
- [ ] Refresh page - stay logged in
- [ ] Backend logs show `userId: <actual-id>`
- [ ] Backend logs show `[Login] Session saved successfully`
- [ ] No more 401 Unauthorized errors
- [ ] Origin header is present in logs

## Rollback Plan

If issues occur:
```bash
git revert HEAD
git push origin prod
```

## Additional Notes

- This fix is **independent** of the frontend API client fix
- Both fixes are needed for complete solution:
  - **Backend fix** (this): Ensures session is saved
  - **Frontend fix** (previous): Ensures API calls go to correct URL
- The OTP login endpoint already had this fix implemented
- This is a common issue when migrating from memory store to database store

## References

- Express Session Documentation: https://github.com/expressjs/session#sessionsavecallback
- Connect-PG-Simple: https://github.com/voxpelli/node-connect-pg-simple
