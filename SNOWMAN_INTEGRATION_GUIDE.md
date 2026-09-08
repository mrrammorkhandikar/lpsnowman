# Load Pilot Snowman → Target Load Pilot Integration Guide

> **Audience:** Another Cursor agent integrating Snowman features into a different Load Pilot codebase on **this same PC**.  
> **Source (read-only reference):** `D:\SmartServeStudios\LoadPilotSnowman`  
> **Target (write destination):** a local Load Pilot folder on this PC (not GitHub). Set `TARGET_ROOT` below before integrating.  
> **Goal:** Port two Snowman key features **without rewriting or breaking** existing shipper/carrier/admin logic in the target repo.

### Local paths on this PC (mandatory)

This code is **local only** — do **not** clone/pull from GitHub for these features. Always use **full absolute Windows paths** when reading Snowman files or writing target files.

| Role | Absolute path |
|------|----------------|
| **SOURCE_ROOT** (Snowman) | `D:\SmartServeStudios\LoadPilotSnowman` |
| **This guide** | `D:\SmartServeStudios\LoadPilotSnowman\SNOWMAN_INTEGRATION_GUIDE.md` |
| **TARGET_ROOT** (other Load Pilot) | `<<< SET THIS — local folder on this PC, e.g. D:\Work\...\loadsmart-logistics >>>` |

When copying a file, always write both sides with full paths, for example:

- Read: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\admin-permissions.ts`
- Write/merge into: `{TARGET_ROOT}\backend\src\admin-permissions.ts`

---

## Product rules (non-negotiable — Feature A)

These rules define how driver functionality must behave in the target after integration:

| # | Rule |
|---|------|
| 1 | **Only admins create portal drivers.** Login-capable drivers are created exclusively via admin APIs/UI (`/api/admin/drivers`, `/admin/drivers`). |
| 2 | **Only admin-created drivers can log into the driver portal.** Portal access requires `users.role = 'driver'` **and** `drivers.user_id` set by admin provisioning. |
| 3 | **Carrier-created drivers must never get portal login.** Enterprise carrier `/api/drivers` (carrier portal) may create fleet `drivers` rows for their own ops, but must **never** create a `users` row with `role=driver`, and must **never** set `drivers.user_id`. Those records cannot open `/driver`. |
| 4 | **No bidding in the driver portal.** Drivers cannot submit bids, view bid UI, accept marketplace loads, or negotiate. |
| 5 | **No marketplace in the driver portal.** Drivers do not browse available loads. Marketplace remains for shippers/carriers/admins only. |
| 6 | **Trips are admin-assigned only (for portal drivers).** Admin assigns loads/trips directly to admin-created drivers (`POST /api/admin/assign` with `driver_id`). Portal drivers do not self-select loads. |
| 7 | **Driver portal is assigned-work only:** my orders / shipments / active trips / documents / profile (+ OTP if target has it). |

### Enforcement checklist (must implement)

**Backend**

- [ ] `POST /api/admin/drivers` creates `users(role=driver)` + `drivers.user_id` (portal-capable).
- [ ] `POST /api/drivers` (carrier) creates `drivers` **without** `userId` and **without** a driver login user.
- [ ] Never allow public register / carrier flows to create `role=driver`.
- [ ] Login for `role=driver` requires a linked `drivers` row (`getDriverByUserId`); otherwise reject.
- [ ] Block driver role from all bid/marketplace endpoints (`/api/bids*`, load feed / accept-direct marketplace actions, etc.) with `403`.
- [ ] Driver load visibility = only shipments already assigned to that `drivers.id`.
- [ ] Portal-driver assignment path for Snowman My Fleet: admin `POST /api/admin/assign` with `driver_id`.

**Frontend**

- [ ] Driver routes: only `/driver`, `/driver/my-orders`, `/driver/shipments`, `/driver/trips`, `/driver/documents`, `/driver/profile` (earnings alias OK if it is the same shipments view).
- [ ] Driver sidebar: **no** Available Loads, Bids, Marketplace, Negotiations.
- [ ] `withRoleGate("driver")` on all driver pages; drivers redirected away from `/carrier/*`, marketplace, bid pages.
- [ ] Admin UI is the only place that collects username/password for a new portal driver.

---

## 0. How to use this document (for the integrating Cursor)

1. Set `TARGET_ROOT` to the absolute path of the target Load Pilot on this PC.
2. Keep **SOURCE_ROOT** read-only: `D:\SmartServeStudios\LoadPilotSnowman`.
3. Follow phases in order (schema → backend → frontend → smoke tests).
4. Prefer **additive** changes. Do not rename existing shipper/carrier/admin behavior.
5. Before editing a shared file, open the Snowman file by **full path**, then merge surgically into the target file by **full path** — never replace whole large files.
6. After each phase, run that phase’s checklist.

### Non-negotiable safety rules

| Rule | Why |
|------|-----|
| Use absolute paths for every read/write | Target/source are local on this PC; not GitHub |
| Do **not** remove or rename existing `shipper` / `carrier` / `admin` behavior | Protects target product |
| Do **not** replace target `routes.ts` / `schema.ts` wholesale | High conflict risk |
| Treat `drivers.id` and `users.id` as **different ID spaces** | Portal assignment uses `drivers.id` |
| Keep frontend + backend `admin-pages.ts` copies in sync | RBAC breaks if keys diverge |
| Full admin = `users.admin_role_id IS NULL` | Do not invent a different meaning |
| Portal trips keyed by `shipments.driverId` → `drivers.id` | Not by load alone |
| Skip demo login `driver` / `driver123` unless product asks | Fake auth |
| Carrier fleet drivers ≠ portal drivers | No `user_id` / no login |

---

## 1. What Snowman adds (scope)

### Feature A — Driver system (admin-assigned, no marketplace)

1. Platform role `driver` (login user) — **admin-provisioned only**.
2. Fleet `drivers` records; portal login only when `drivers.user_id` is set by admin.
3. **Driver portal** (`/driver/*`) for **assigned** trips, OTP, documents, profile — **no bidding, no marketplace**.
4. **Admin My Fleet / drivers** pages to create drivers with login accounts.
5. **Admin direct assignment** sets `shipments.driverId` (and truck) via `/api/admin/assign`.
6. Fleet availability locking so a driver/truck is not double-booked.

### Feature B — Role-based admin (page-key RBAC)

1. Table `admin_roles` with `page_keys text[]`.
2. Column `users.admin_role_id` (null = **full admin**, all pages).
3. Session enrichment: `adminPageKeys`, `adminRoleName`, `isFullAdmin`.
4. Frontend nav + route gate by page key.
5. Admin UI: `/admin/roles` + role assignment on `/admin/users`.

### Explicitly out of scope / do not port into driver experience

- Marketplace browse / bid / negotiate UI or APIs for `role=driver`
- Giving carrier-created drivers portal credentials
- Marketing page `/solutions/drivers` (optional)
- Dummy localStorage driver login
- Telemetry / driver-behavior scoring (optional)

Carrier marketplace bidding may still exist for **carriers** in the target app. That must remain for carriers — just **never** expose it to drivers.

---

## 2. Mental model (read before coding)

### 2.1 Driver concepts

| Concept | Storage | Portal login? | Used for |
|---------|---------|---------------|----------|
| **Admin portal driver** | `users.role='driver'` + `drivers.user_id` set by **admin** | **Yes** → `/driver` | Admin-assigned trips only |
| **Carrier fleet driver record** | `drivers` row created via carrier portal; **`user_id` null** | **No** | Carrier internal fleet / their own bids (not driver portal) |
| **Solo carrier** | `users.role='carrier'`, `carrierType='solo'` | Carrier portal only | Acts as own driver; **not** `role=driver` |

**Provisioning (portal):**

1. Admin creates `users` (`role: driver`, username/password).
2. Admin creates `drivers` with `userId` → that user, `carrierId` typically admin’s user id (My Fleet).
3. Admin assigns trips to that `drivers.id`.
4. Driver logs in → sees only assigned work.

**Carrier path (non-portal):**

1. Enterprise carrier creates driver via `/api/drivers` → `drivers` row, **no** `userId`.
2. That person **cannot** log into `/driver`.
3. Do not “upgrade” them to portal login unless an **admin** explicitly provisions credentials (product default: leave them without login).

### 2.2 ID rules (critical)

| Field | References |
|-------|------------|
| `shipments.driverId`, `bids.driverId`, `documents.driverId` | **`drivers.id`** |
| `drivers.userId`, `drivers.carrierId` | **`users.id`** |
| Session `driverId` from login/`/api/auth/me` | **`drivers.id`** (for `role=driver`) |
| Some telemetry `driverId` fields | **`users.id`** (do not mix) |

### 2.3 Full vs role-based admin

```
users.role = 'admin'
  ├─ admin_role_id IS NULL     → Full Admin (all ADMIN_PAGE_KEYS)
  └─ admin_role_id = <uuid>    → Role-based (admin_roles.page_keys + always "overview")
```

Frontend is the main page gate. Backend page-key checks in Snowman mainly cover `/api/admin/users` and `/api/admin/roles*`. Most other `/api/admin/*` only check `role === 'admin'`.

---

## 3. Recommended integration order

```
Phase 0  Audit target repo (diff feature presence) — use absolute TARGET_ROOT
Phase 1  Schema + migrations (driver user link + admin_roles)
Phase 2  Shared catalogs + permission helpers
Phase 3  Storage methods
Phase 4  Auth session enrichment (driverId + admin extras)
Phase 5  Driver APIs + admin-only assign + block bid/marketplace APIs
Phase 6  Admin roles / users APIs
Phase 7  Frontend auth + gates + sidebar (no marketplace for drivers)
Phase 8  Driver portal pages + routes (assigned work only)
Phase 9  Admin drivers / assign / roles / users UI
Phase 10 Smoke tests + conflict review
```

---

## 4. Phase 0 — Audit the target repo

Search under `{TARGET_ROOT}` for these signals. Only port what is missing.

| Signal | Meaning if present |
|--------|--------------------|
| `role === "driver"` or `userRoles` includes `"driver"` | Role may already exist |
| `drivers.user_id` / `userId` on drivers table | Portal link may exist |
| `/api/driver/` routes | Portal API may exist |
| `/driver` routes in App | Portal UI may exist |
| `admin_roles` / `adminRoleId` / `admin-pages.ts` | RBAC may exist |
| `AdminAccessGate` / `useAdminAccess` | Frontend RBAC may exist |
| `POST /api/admin/assign` with `driver_id` | My Fleet assignment may exist |
| `fleet-availability.ts` | Availability helpers may exist |

Also verify target carrier driver create path does **not** set `userId` (and fix if it does).

---

## 5. Phase 1 — Database / schema (additive)

### 5.1 Migrations to port from Snowman

| Snowman absolute path | What it adds |
|-----------------------|--------------|
| `D:\SmartServeStudios\LoadPilotSnowman\backend\migrations\0008_driver_user_accounts.sql` | `drivers.user_id` + unique partial index |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\migrations\0011_admin_roles.sql` | `admin_roles` + `users.admin_role_id` |

Copy SQL into the target’s migration system under `{TARGET_ROOT}\backend\migrations\` (keep numbering consistent with target). Register in the target migration runner if used (Snowman runner: `D:\SmartServeStudios\LoadPilotSnowman\backend\scripts\schema-migrations.ts`).

**`0008` essence:**

```sql
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "drivers_user_id_unique" ON "drivers" ("user_id") WHERE "user_id" IS NOT NULL;
```

**`0011` essence:**

```sql
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
```

### 5.2 Schema.ts changes

Snowman sources (merge into both mirrors if target duplicates schema):

- `D:\SmartServeStudios\LoadPilotSnowman\backend\src\shared\schema.ts`
- `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\shared\schema.ts`

Target destinations:

- `{TARGET_ROOT}\backend\src\shared\schema.ts`
- `{TARGET_ROOT}\frontend\src\shared\schema.ts` (if present)

**Required additive edits:**

1. `userRoles` includes `"driver"`.
2. `users.adminRoleId` column mapping.
3. `adminRoles` table.
4. `drivers.userId` column (nullable).
5. Ensure `shipments.driverId` / `bids.driverId` exist if target uses them for fleet; portal assignment needs `shipments.driverId`.
6. Export `AdminRole`, `InsertAdminRole`, `Driver`, `InsertDriver`.

### Phase 1 checklist

- [ ] Migration applies on a copy of target DB  
- [ ] Existing shipper/carrier/admin users still load  
- [ ] Existing admins with `admin_role_id = null` remain full admins  

---

## 6. Phase 2 — Shared page catalog + permission module

| Snowman absolute path | Target destination |
|-----------------------|--------------------|
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\shared\admin-pages.ts` | `{TARGET_ROOT}\backend\src\shared\admin-pages.ts` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\shared\admin-pages.ts` | `{TARGET_ROOT}\frontend\src\shared\admin-pages.ts` |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\admin-permissions.ts` | `{TARGET_ROOT}\backend\src\admin-permissions.ts` |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\fleet-availability.ts` | `{TARGET_ROOT}\backend\src\fleet-availability.ts` |

Keep both `admin-pages.ts` copies identical. Adapt `path` values to **target** admin URLs; keep **keys** stable when possible:

`overview`, `post_load`, `load_queue`, `negotiations`, `otp_verification`, `live_tracking`, `shipper_onboarding`, `invoices`, `users`, `admin_roles`, `fleet_add_truck`, `fleet`, `drivers`, `loads`, `carriers`, `carrier_verification`, `document_review`, `reports`

- `overview` always granted  
- `FLEET_PAGE_KEYS` = `fleet`, `fleet_add_truck`, `drivers`

---

## 7. Phase 3 — Storage layer

Snowman: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\storage.ts`  
Target: `{TARGET_ROOT}\backend\src\storage.ts`

Add if missing:

- `getDriverByUserId(userId)`
- `getShipmentsByDriver(driverId)`
- `getDocumentsByDriver(driverId)` (if docs exist)
- Admin roles: `getAdminRole`, `getAllAdminRoles`, `createAdminRole`, `updateAdminRole`, `deleteAdminRole`, `countUsersWithAdminRole`

Admin create-driver path must support creating `role: "driver"` user + linking `drivers.userId`.  
Carrier create-driver path must leave `userId` null.

---

## 8. Phase 4 — Auth session enrichment

Snowman reference: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\routes.ts` (login + `/api/auth/me`)  
Target: `{TARGET_ROOT}\backend\src\routes.ts`

**Driver login:**

- If `role === "driver"`: resolve `getDriverByUserId`; attach `driverId: drivers.id`.
- If no linked driver row → treat as unauthorized / incomplete profile (do not enter portal).

**Admin login:**

- Spread `await enrichAdminSessionUser(user)` → `adminRoleId`, `adminRoleName`, `adminPageKeys`, `isFullAdmin`.

Frontend auth type — Snowman:  
`D:\SmartServeStudios\LoadPilotSnowman\frontend\src\lib\auth-context.tsx`  
Target: `{TARGET_ROOT}\frontend\src\lib\auth-context.tsx`

Add optional fields: `driverId`, `adminRoleId`, `adminRoleName`, `adminPageKeys`, `isFullAdmin`.

Post-login redirect: `admin → /admin`, `driver → /driver`, `carrier → /carrier`, else shipper.

Drivers cannot self-change password via profile API (admin provisions credentials).

Skip porting demo `driver` / `driver123` localStorage bypass unless explicitly requested.

---

## 9. Phase 5 — Driver APIs, admin assignment, block marketplace

Snowman routes reference: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\routes.ts`  
Availability: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\fleet-availability.ts`  
Workflow: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\workflow-service.ts`  
Doc sync (optional): `D:\SmartServeStudios\LoadPilotSnowman\backend\src\driver-document-sync.ts`

### 9.1 `requireDriverUser`

```ts
// role === "driver" AND linked drivers row required
const requireDriverUser = async (req, res) => { ... return { user, driver } | null };
```

`userCanAccessShipment`: allow driver only when `shipment.driverId === driver.id`.

### 9.2 Driver portal APIs (assigned work only)

| Method | Path | Notes |
|--------|------|-------|
| GET/PATCH | `/api/driver/profile` | Profile + stats |
| GET | `/api/driver/my-orders` | Assigned orders only |
| GET | `/api/driver/shipments` | Assigned shipments |
| GET | `/api/driver/shipments/tracking` | Tracking |
| GET | `/api/driver/documents/expiring` | Optional |
| GET | `/api/driver/verification` | Optional |
| POST | `/api/driver/documents` | Upload |
| DELETE | `/api/driver/documents/:docId` | Own docs |

**Do not** add driver endpoints for: available loads, bid submit, bid list, negotiate, accept-direct marketplace.

### 9.3 Hard-block bidding / marketplace for drivers

In target `routes.ts`, any of these (and equivalents) must reject `role === "driver"` with 403:

- Bid create/submit/list/negotiate
- Marketplace load feed intended for carriers
- Accept-direct / carrier claim flows
- Any “browse open loads” API

Drivers may still call OTP / shipment document endpoints **only** for shipments assigned to them.

### 9.4 Admin driver CRUD (portal credentials live here only)

| Method | Path |
|--------|------|
| GET/POST | `/api/admin/drivers` |
| GET/PATCH/DELETE | `/api/admin/drivers/:id` |
| GET | `/api/admin/drivers/:id/documents` |

Admin create:

1. `users` with `role: "driver"` + credentials  
2. `drivers` with `userId` + `carrierId` (My Fleet → admin user id)  
3. Optional document sync

### 9.5 Carrier driver CRUD (no portal login)

| Method | Path | Constraint |
|--------|------|------------|
| GET/POST/PATCH/DELETE | `/api/drivers` | **Never** set `userId`; **never** create `users.role=driver` |

### 9.6 Trip assignment for portal drivers — admin only

Primary path — merge from Snowman `POST /api/admin/assign`:

- Body: `load_id`, `carrier_id?`, `truck_id?`, `driver_id?`, pricing fields  
- If `driver_id` provided → resolve carrier/truck from driver  
- My Fleet: carrier may be admin user (`carrier.id === admin.id && role === "admin"`)  
- Run fleet availability checks  
- Create shipment with `driverId`  
- Notify `assignedDriver.userId` for portal drivers  

**For Snowman portal product behavior:** admin-created drivers receive work **only** through this admin assignment (not by bidding).

Carrier marketplace bid paths that set `bids.driverId` for **carrier fleet drivers** (no login) may remain for carriers — that is separate from the driver portal. Do not wire portal drivers into bid submission.

### 9.7 Availability + visibility

From `fleet-availability.ts`:

- Terminal statuses freeing fleet: `delivered`, `closed`, `cancelled`, `completed`
- Block double-booking on active shipments / accepted bids
- Do not delete drivers with shipment history

Workflow: `role === "driver"` → only loads tied to that driver’s shipments (assigned), never open marketplace loads.

### Phase 5 checklist

- [ ] Carrier bid flows still work for carriers  
- [ ] Driver calling bid/marketplace APIs gets 403  
- [ ] Admin assigns My Fleet driver → `shipments.driverId` set  
- [ ] That driver sees it on `/api/driver/my-orders`  
- [ ] Carrier-created driver has `user_id` null and cannot log into portal  
- [ ] Double-assign same driver on two active trips rejected  

---

## 10. Phase 6 — Admin roles APIs

Search Snowman `D:\SmartServeStudios\LoadPilotSnowman\backend\src\routes.ts` for `assertAdminPageAccess`, `/api/admin/roles`.  
Helpers: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\admin-permissions.ts`

| Method | Path | Page key |
|--------|------|----------|
| GET | `/api/admin/pages` | any admin |
| GET | `/api/admin/roles/assignable` | `users` |
| GET/POST | `/api/admin/roles` | `admin_roles` |
| PATCH/DELETE | `/api/admin/roles/:id` | `admin_roles` |
| GET/POST/PATCH | `/api/admin/users` (+ `/:id`) | `users` — support `adminRoleId` |

Privilege rules: no escalation beyond actor’s page keys; cannot delete role still in use; `adminRoleId` implies `role=admin`.

---

## 11. Phase 7 — Frontend gates, sidebar, i18n

| Snowman absolute path | Target destination |
|-----------------------|--------------------|
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\hooks\use-admin-access.ts` | `{TARGET_ROOT}\frontend\src\hooks\use-admin-access.ts` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\admin-access-gate.tsx` | `{TARGET_ROOT}\frontend\src\components\admin-access-gate.tsx` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\app-sidebar.tsx` | Merge into `{TARGET_ROOT}\frontend\src\components\app-sidebar.tsx` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\App.tsx` | Merge into `{TARGET_ROOT}\frontend\src\App.tsx` |

### Driver nav (allowed only)

From Snowman sidebar `driverItems`:

- Profile → `/driver/profile`
- My Orders → `/driver/my-orders`
- Shipments → `/driver/shipments`
- Active Trips → `/driver/trips`
- Documents → `/driver/documents`

**Forbidden for drivers:** Available Loads, My Bids, Marketplace, Negotiations, Revenue bid tools, carrier load feed.

### App routing merges

1. `withRoleGate("driver", "/auth")` on driver pages only  
2. `<AdminAccessGate>` around `/admin/*`  
3. Driver redirect → `/driver`  
4. If a driver hits `/carrier/*`, `/shipper/*`, or bid/marketplace routes → redirect to `/driver`  
5. Register `/admin/roles`, `/admin/drivers`, `/admin/drivers/:driverId`

### Admin sidebar RBAC

- `pageKey` on items; fleet section uses `FLEET_PAGE_KEYS`
- `filterAdminNavItems(adminItems, hasPage)`

### Styles

No separate RBAC stylesheet. Match target shadcn/Tailwind:

- Full Admin badge: `text-red-600 border-red-400`
- Role-based badge: `text-violet-600 border-violet-400`

i18n: add `nav.adminRoles`, `nav.myCarriers`, driver nav keys, `roles.adminConsole` (see Snowman `frontend\src\i18n\locales\en.json`).

---

## 12. Phase 8 — Driver portal UI (no marketplace)

| Snowman absolute path | Route |
|-----------------------|-------|
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\driver\my-orders.tsx` | `/driver`, `/driver/my-orders` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\driver\shipments.tsx` | `/driver/shipments` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\driver\trips.tsx` | `/driver/trips` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\driver\documents.tsx` | `/driver/documents` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\driver\profile.tsx` | `/driver/profile` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\driver\index.ts` | barrel |

Shared: `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\otp-trip-actions.tsx` (adapt if target has OTP).

**Strip / do not port into driver portal:**

- Any bid buttons, load feed, “available loads”, negotiate drawers
- Links to carrier marketplace
- Self-assignment of open loads

Pages should only show **admin-assigned** trips/orders.

### Phase 8 checklist

- [ ] Non-drivers cannot open `/driver`  
- [ ] Driver home = assigned orders only  
- [ ] No bid/marketplace UI reachable while `role=driver`  
- [ ] Profile via `/api/driver/profile`  

---

## 13. Phase 9 — Admin driver + roles UI

| Snowman absolute path | Route / purpose |
|-----------------------|-----------------|
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\drivers.tsx` | `/admin/drivers` — create portal drivers (+ login) |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\my-carrier-profile.tsx` | `/admin/drivers/:driverId` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\roles.tsx` | `/admin/roles` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\users.tsx` | Merge Full vs Role-based admin |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\admin\my-fleet-pricing-drawer.tsx` | Assign driver/truck (My Fleet) |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\load-queue.tsx` | Wire drawer / assign |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\load-details.tsx` | Show / reassign driver |

**Admin is the only UI that sets driver username/password.**

Assignment UX: admin picks available admin-fleet driver + truck → `POST /api/admin/assign`.

Merge users page additively for `adminRoleId` / assignable roles — do not replace entire page.

---

## 14. End-to-end flows (acceptance)

### Flow A — Admin-created driver (happy path)

```
Admin creates driver (+ username/password) at /admin/drivers
  → users.role=driver + drivers.user_id linked
  → Admin assigns load via POST /api/admin/assign (driver_id + truck_id)
  → shipment.driverId set
  → Driver logs in → /driver/my-orders shows that load only
  → Driver has NO marketplace / NO bid UI
  → OTP start/route/end if enabled
  → Terminal status frees driver
```

### Flow B — Carrier-created driver cannot use portal

```
Enterprise carrier creates driver at /carrier/drivers (or POST /api/drivers)
  → drivers row with user_id NULL
  → No users.role=driver created
  → That person cannot log into /driver
```

### Flow C — Role-based admin

```
Full admin creates role with subset of page_keys
  → Assigns to admin user
  → Sidebar + AdminAccessGate enforce pages
```

### Flow D — Do not break

```
Shipper/carrier marketplace bidding continues for carriers
  → Unaffected by driver portal
  → Drivers still cannot participate in bidding
```

---

## 15. File inventory (absolute Snowman paths)

### Backend — Feature A (Driver)

| Snowman absolute path | Action |
|-----------------------|--------|
| `D:\SmartServeStudios\LoadPilotSnowman\backend\migrations\0008_driver_user_accounts.sql` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\shared\schema.ts` | Merge |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\fleet-availability.ts` | Port if missing |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\driver-document-sync.ts` | Optional |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\storage.ts` | Merge |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\routes.ts` | Merge driver/admin-driver/assign + block driver bids |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\workflow-service.ts` | Merge driver visibility |

### Backend — Feature B (RBAC)

| Snowman absolute path | Action |
|-----------------------|--------|
| `D:\SmartServeStudios\LoadPilotSnowman\backend\migrations\0011_admin_roles.sql` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\shared\admin-pages.ts` | Port + adapt paths |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\admin-permissions.ts` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\shared\schema.ts` | Merge admin roles |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\storage.ts` | Merge role CRUD |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\routes.ts` | Merge roles/users + enrichAdminSessionUser |

### Frontend — Feature A

| Snowman absolute path | Action |
|-----------------------|--------|
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\driver\` | Port (no bid UI) |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\otp-trip-actions.tsx` | Adapt if OTP exists |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\lib\auth-context.tsx` | Merge `driverId` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\app-sidebar.tsx` | Merge `driverItems` only |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\App.tsx` | Merge driver routes + redirects |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\drivers.tsx` | Port/merge |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\my-carrier-profile.tsx` | Port/merge |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\admin\my-fleet-pricing-drawer.tsx` | Port/merge |

### Frontend — Feature B

| Snowman absolute path | Action |
|-----------------------|--------|
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\shared\admin-pages.ts` | Port (sync with backend) |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\hooks\use-admin-access.ts` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\admin-access-gate.tsx` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\roles.tsx` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\users.tsx` | Merge role assignment |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\lib\admin-data-store.tsx` | Merge if used |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\i18n\locales\en.json` | Merge nav keys |

Every write goes to the matching path under `{TARGET_ROOT}\...` using the **full absolute target path**.

---

## 16. Conflict avoidance playbook

| Situation | Safe approach |
|-----------|---------------|
| Need a Snowman snippet | Open full path under `D:\SmartServeStudios\LoadPilotSnowman\...` |
| Need to edit target | Open full path under `{TARGET_ROOT}\...` |
| Huge diverged `routes.ts` | Search symbols; port blocks; never overwrite whole file |
| Target has `drivers` without `user_id` | Add column + admin provision path only |
| Target admin URLs differ | Adapt paths in `admin-pages.ts`, keep keys |
| Carrier `/api/drivers` exists | Keep for carriers; enforce `userId` stays null |
| Target OTP differs | Reuse target OTP APIs inside Snowman driver page shells |
| Auth differs (JWT vs session) | Keep target auth; add role checks + payload fields |

---

## 17. Known Snowman caveats

1. Most `/api/admin/*` APIs are role-admin only, not page-key gated.
2. Some unmapped admin URLs bypass page-key denial.
3. Overview widgets are not filtered by `hasPage`.
4. Telemetry `driverId` may mean `users.id` — do not mix with `shipments.driverId`.
5. Prefer admin-created admins only (avoid public `role=admin` register).
6. Skip demo `driver` / `driver123`.

---

## 18. Minimal smoke test script

1. Migrate DB; start API + UI from `{TARGET_ROOT}`.
2. Existing full admin → previous admin pages still work.
3. Create role-based admin → nav/pages filtered.
4. **Admin** creates driver with login → driver reaches `/driver`.
5. Admin assigns load to that driver → appears in My Orders.
6. Confirm driver UI has **no** bids / available loads / marketplace.
7. Driver API bid attempt → 403.
8. **Carrier** creates a fleet driver → `user_id` null → cannot log into driver portal.
9. Shipper + carrier marketplace flows still work for those roles.

---

## 19. Prompt template for the integrating Cursor

```text
Integrate Load Pilot Snowman features into the TARGET Load Pilot on this PC.

SOURCE_ROOT (read-only):
D:\SmartServeStudios\LoadPilotSnowman

GUIDE (follow exactly):
D:\SmartServeStudios\LoadPilotSnowman\SNOWMAN_INTEGRATION_GUIDE.md

TARGET_ROOT (write here — local only, not GitHub):
<<< PASTE ABSOLUTE PATH OF TARGET LOAD PILOT >>>

Features:
1) Driver system — admin-only portal drivers, admin-only trip assignment,
   driver portal with NO bidding and NO marketplace.
2) Role-based admin — admin_roles + page-key RBAC, gates, roles/users UI.

Product rules:
- Only admins create drivers that can log into /driver (users.role=driver + drivers.user_id).
- Carrier-created drivers must never get portal login (no user_id, no driver user).
- Drivers cannot bid or browse marketplace; only see admin-assigned trips.
- Use FULL absolute Windows paths for every file read/write.
- Additive merges only; never replace schema.ts, routes.ts, or App.tsx wholesale.
- Do not break shipper/carrier existing logic.
- Keep backend/frontend admin-pages.ts in sync.
- Skip demo driver/driver123 login.
- Work phase by phase; after each phase summarize absolute paths touched and risks.
```

---

## 20. Quick reference — symbols to search in Snowman

Search inside `D:\SmartServeStudios\LoadPilotSnowman`:

```
requireDriverUser
getDriverByUserId
enrichAdminSessionUser
assertAdminPageAccess
assertAdminCanAssignRole
hasAdminPageAccess
AdminAccessGate
useAdminAccess
filterAdminNavItems
pathnameToAdminPageKey
ADMIN_PAGE_KEYS
FLEET_PAGE_KEYS
buildFleetAvailabilityContext
isDriverFleetAvailable
/api/admin/assign
/api/driver/
/api/admin/roles
/api/admin/drivers
POST /api/drivers
```

When in doubt, open the matching file under  
`D:\SmartServeStudios\LoadPilotSnowman\...`  
by full path, port the smallest coherent block, then merge into  
`{TARGET_ROOT}\...`  
by full path.
