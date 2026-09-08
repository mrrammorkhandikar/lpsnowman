# Load Pilot Snowman → Role-Based Admin Migration Guide

> **Audience:** Another Cursor agent porting **role-based admin (page-key RBAC)** into a different Load Pilot codebase on **this same PC**.  
> **Source (read-only reference):** `D:\SmartServeStudios\LoadPilotSnowman`  
> **Target (write destination):** a local Load Pilot folder on this PC (not GitHub). Set `TARGET_ROOT` below before integrating.  
> **Goal:** Port Feature B (admin roles + page-key RBAC) **without rewriting or breaking** existing shipper/carrier/full-admin logic in the target repo.  
> **Sibling guide (drivers):** `D:\SmartServeStudios\LoadPilotSnowman\SNOWMAN_INTEGRATION_GUIDE.md` — use that for Feature A; this file is **RBAC only**.

### Local paths on this PC (mandatory)

This code is **local only** — do **not** clone/pull from GitHub for this feature. Always use **full absolute Windows paths** when reading Snowman files or writing target files.

| Role | Absolute path |
|------|----------------|
| **SOURCE_ROOT** (Snowman) | `D:\SmartServeStudios\LoadPilotSnowman` |
| **This guide** | `D:\SmartServeStudios\LoadPilotSnowman\ROLE_BASED_ADMIN_MIGRATION_GUIDE.md` |
| **Parent integration guide** | `D:\SmartServeStudios\LoadPilotSnowman\SNOWMAN_INTEGRATION_GUIDE.md` |
| **TARGET_ROOT** (other Load Pilot) | `<<< SET THIS — local folder on this PC, e.g. D:\Work\...\loadsmart-logistics >>>` |

When copying a file, always write both sides with full paths, for example:

- Read: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\admin-permissions.ts`
- Write/merge into: `{TARGET_ROOT}\backend\src\admin-permissions.ts`

---

## Product rules (non-negotiable — Role-based admin)

These rules define how admin RBAC must behave in the target after integration:

| # | Rule |
|---|------|
| 1 | **Only `users.role = 'admin'` can use the admin console.** Shipper/carrier/driver never get `adminPageKeys`. |
| 2 | **Full admin = `admin_role_id IS NULL`.** That user gets every key in `ADMIN_PAGE_KEYS`. Do not invent another meaning for “full admin”. |
| 3 | **Role-based admin = `admin_role_id` points at `admin_roles`.** Access = that role’s `page_keys` **plus** always `overview`. |
| 4 | **`overview` is always granted** to every admin (full or role-based). It is never assignable/removable as a privilege. |
| 5 | **Frontend is the primary page gate.** Sidebar filters + `AdminAccessGate` block routes by page key. |
| 6 | **Backend page-key checks mainly cover users/roles APIs.** In Snowman, most other `/api/admin/*` only check `role === 'admin'`. Match that unless the target product asks for stricter API gating. |
| 7 | **No privilege escalation.** A role-based admin cannot create/assign a role whose `page_keys` exceed their own keys. |
| 8 | **Cannot delete a role still assigned to users.** Reassign or clear `admin_role_id` first. |
| 9 | **Assigning `adminRoleId` implies `role = admin`.** Non-admins must not keep an `admin_role_id`. |
| 10 | **Keep backend + frontend `admin-pages.ts` identical** (keys stable; adapt `path` values to target URLs). |

### Enforcement checklist (must implement)

**Backend**

- [ ] Migration creates `admin_roles` + `users.admin_role_id` (+ index).
- [ ] Existing admins with `admin_role_id = null` remain full admins after migrate.
- [ ] Login + `/api/auth/me` call `enrichAdminSessionUser` → `adminRoleId`, `adminRoleName`, `adminPageKeys`, `isFullAdmin`.
- [ ] `GET /api/admin/pages` returns assignable pages (any admin).
- [ ] CRUD `/api/admin/roles*` gated by page key `admin_roles`.
- [ ] `GET /api/admin/roles/assignable` gated by `users`; filtered to actor’s key subset.
- [ ] Admin users create/update supports `adminRoleId` (null = full admin); escalate checks via `assertAdminCanAssignRole`.
- [ ] Delete role blocked when `countUsersWithAdminRole > 0`.

**Frontend**

- [ ] Auth user type includes `adminRoleId`, `adminRoleName`, `adminPageKeys`, `isFullAdmin`.
- [ ] `useAdminAccess` + `AdminAccessGate` wrap `/admin/*`.
- [ ] Admin sidebar items carry `pageKey` / fleet `pageKeys`; filtered with `hasPage`.
- [ ] `/admin/roles` UI for create/edit/delete roles.
- [ ] `/admin/users` can assign Full Admin vs a role (merge, do not replace whole page).
- [ ] Full Admin badge vs Role-based badge styling (match target design system).

---

## 0. How to use this document (for the integrating Cursor)

1. Set `TARGET_ROOT` to the absolute path of the target Load Pilot on this PC.
2. Keep **SOURCE_ROOT** read-only: `D:\SmartServeStudios\LoadPilotSnowman`.
3. Follow phases in order (audit → schema → catalogs/helpers → storage → auth → APIs → frontend → smoke tests).
4. Prefer **additive** changes. Do not rename existing full-admin / shipper / carrier behavior.
5. Before editing a shared file, open the Snowman file by **full path**, then merge surgically into the target file by **full path** — never replace whole large files.
6. After each phase, run that phase’s checklist.

### Non-negotiable safety rules

| Rule | Why |
|------|-----|
| Use absolute paths for every read/write | Target/source are local on this PC; not GitHub |
| Do **not** remove or rename existing `shipper` / `carrier` / full-admin behavior | Protects target product |
| Do **not** replace target `routes.ts` / `schema.ts` / `App.tsx` wholesale | High conflict risk |
| Full admin = `users.admin_role_id IS NULL` | Do not invent a different meaning |
| Keep frontend + backend `admin-pages.ts` copies in sync | RBAC breaks if keys diverge |
| Adapt `path` values to **target** admin URLs; keep **keys** stable | Nav + gate stay consistent |
| Additive merges only on users UI | Existing user-management must keep working |

---

## 1. What this migration adds (scope)

### In scope — Role-based admin (page-key RBAC)

1. Table `admin_roles` with `page_keys text[]`.
2. Column `users.admin_role_id` (null = **full admin**, all pages).
3. Shared page catalog: `admin-pages.ts` (backend + frontend mirrors).
4. Permission helpers: `admin-permissions.ts` (`enrichAdminSessionUser`, `hasAdminPageAccess`, escalation checks).
5. Session enrichment: `adminPageKeys`, `adminRoleName`, `isFullAdmin`.
6. APIs: `/api/admin/pages`, `/api/admin/roles*`, users endpoints supporting `adminRoleId`.
7. Frontend: `useAdminAccess`, `AdminAccessGate`, sidebar filter, `/admin/roles`, users role assignment.

### Explicitly out of scope

- Driver portal / admin-created drivers / My Fleet assignment (see parent guide Feature A)
- Per-endpoint page-key gating on every `/api/admin/*` (Snowman does **not** do this; optional enhancement only if product requires it)
- Overview dashboard widget filtering by `hasPage` (known Snowman caveat)
- Public self-registration as `role=admin`
- Changing shipper/carrier roles or marketplace

---

## 2. Mental model (read before coding)

### 2.1 Full vs role-based admin

```
users.role = 'admin'
  ├─ admin_role_id IS NULL     → Full Admin (all ADMIN_PAGE_KEYS)
  └─ admin_role_id = <uuid>    → Role-based (admin_roles.page_keys + always "overview")
```

| Concept | Storage | Access |
|---------|---------|--------|
| **Full admin** | `role='admin'`, `admin_role_id` null | All page keys |
| **Role-based admin** | `role='admin'`, `admin_role_id` set | Role’s `page_keys` + `overview` |
| **Non-admin** | any other role | No admin pages / empty enrichment |

### 2.2 Page keys (canonical catalog)

Stable **keys** (do not rename casually):

`overview`, `post_load`, `load_queue`, `negotiations`, `otp_verification`, `live_tracking`, `shipper_onboarding`, `invoices`, `users`, `admin_roles`, `fleet_add_truck`, `fleet`, `drivers`, `loads`, `carriers`, `carrier_verification`, `document_review`, `reports`

- `overview` always granted  
- `FLEET_PAGE_KEYS` = `fleet`, `fleet_add_truck`, `drivers` (sidebar section visible if any of these match)

Snowman paths (adapt if target URLs differ):

| Key | Default path |
|-----|----------------|
| `overview` | `/admin` |
| `post_load` | `/admin/post-load` |
| `load_queue` | `/admin/queue` |
| `negotiations` | `/admin/negotiations` |
| `otp_verification` | `/admin/otp-queue` |
| `live_tracking` | `/admin/live-tracking` |
| `shipper_onboarding` | `/admin/onboarding` |
| `invoices` | `/admin/invoices` |
| `users` | `/admin/users` |
| `admin_roles` | `/admin/roles` |
| `fleet_add_truck` | `/admin/fleet/add-truck` |
| `fleet` | `/admin/fleet` |
| `drivers` | `/admin/drivers` |
| `loads` | `/admin/loads` |
| `carriers` | `/admin/carriers` |
| `carrier_verification` | `/admin/verification` |
| `document_review` | `/admin/finance-review` |
| `reports` | `/admin/reports` |

### 2.3 Where enforcement lives

| Layer | What it does |
|-------|----------------|
| **DB** | Roles + FK on users |
| **Auth session** | Emits `adminPageKeys` / `isFullAdmin` |
| **Frontend gate** | Blocks URL navigation by key |
| **Sidebar** | Hides nav items without access |
| **Backend (users/roles)** | `assertAdminPageAccess` + no-escalation |

---

## 3. Recommended migration order

```
Phase 0  Audit target repo (diff RBAC presence) — use absolute TARGET_ROOT
Phase 1  Schema + migration (admin_roles + users.admin_role_id)
Phase 2  Shared page catalog + permission helpers
Phase 3  Storage methods (role CRUD + count)
Phase 4  Auth session enrichment
Phase 5  Admin roles / users / pages APIs
Phase 6  Frontend hooks, gate, sidebar, App routes
Phase 7  Admin roles UI + users role assignment UI
Phase 8  Smoke tests + conflict review
```

---

## 4. Phase 0 — Audit the target repo

Search under `{TARGET_ROOT}` for these signals. Only port what is missing.

| Signal | Meaning if present |
|--------|--------------------|
| `admin_roles` / `adminRoleId` / `admin_role_id` | Schema/RBAC may exist |
| `admin-pages.ts` / `ADMIN_PAGE_KEYS` | Page catalog may exist |
| `admin-permissions.ts` / `enrichAdminSessionUser` | Backend helpers may exist |
| `AdminAccessGate` / `useAdminAccess` | Frontend RBAC may exist |
| `/admin/roles` / `/api/admin/roles` | Roles UI/API may exist |
| `filterAdminNavItems` / `pageKey` on admin nav | Sidebar RBAC may exist |
| `isFullAdmin` on auth user | Session enrichment may exist |

Also list target admin routes/URLs so you can adapt `admin-pages.ts` `path` values without renaming keys.

### Phase 0 checklist

- [ ] Confirmed whether `admin_roles` already exists  
- [ ] Mapped target admin URL list vs Snowman paths  
- [ ] Noted whether users admin page already exists (merge vs port)

---

## 5. Phase 1 — Database / schema (additive)

### 5.1 Migration to port from Snowman

| Snowman absolute path | What it adds |
|-----------------------|--------------|
| `D:\SmartServeStudios\LoadPilotSnowman\backend\migrations\0011_admin_roles.sql` | `admin_roles` + `users.admin_role_id` + index |

Copy SQL into the target’s migration system under `{TARGET_ROOT}\backend\migrations\` (keep numbering consistent with target). Register in the target migration runner if used (Snowman runner: `D:\SmartServeStudios\LoadPilotSnowman\backend\scripts\schema-migrations.ts`).

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

1. `users.adminRoleId` column mapping (`varchar("admin_role_id")`) — null = full admin.
2. `adminRoles` table (`id`, `name`, `description`, `pageKeys`, `createdBy`, `createdAt`).
3. Export `AdminRole`, `InsertAdminRole` (and insert schema if target uses drizzle-zod).

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

Keep both `admin-pages.ts` copies identical. Adapt `path` values to **target** admin URLs; keep **keys** stable when possible.

Required helpers from `admin-permissions.ts`:

- `isAdminUser`, `isFullAdmin`
- `normalizeAssignablePageKeys`, `withOverviewPageKeys`
- `resolveAdminPageKeys`, `resolveAdminRoleName`
- `hasAdminPageAccess`, `isPageKeySubset`
- `enrichAdminSessionUser`
- `assertAdminCanAssignRole`

### Phase 2 checklist

- [ ] Backend/frontend `admin-pages.ts` keys match  
- [ ] Paths match real target routes  
- [ ] `pathnameToAdminPageKey` longest-prefix match works for nested admin URLs  

---

## 7. Phase 3 — Storage layer

Snowman: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\storage.ts`  
Target: `{TARGET_ROOT}\backend\src\storage.ts`

Add if missing:

- `getAdminRole(id)`
- `getAllAdminRoles()`
- `createAdminRole(role)`
- `updateAdminRole(id, updates)`
- `deleteAdminRole(id)`
- `countUsersWithAdminRole(roleId)`

Ensure user create/update can persist `adminRoleId`.

### Phase 3 checklist

- [ ] Role CRUD round-trips against DB  
- [ ] Count-in-use blocks delete path at API layer  

---

## 8. Phase 4 — Auth session enrichment

Snowman reference: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\routes.ts` (login + `/api/auth/me`)  
Helpers: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\admin-permissions.ts`  
Target: `{TARGET_ROOT}\backend\src\routes.ts`

**Admin login / me:**

- Spread `await enrichAdminSessionUser(user)` → `adminRoleId`, `adminRoleName`, `adminPageKeys`, `isFullAdmin`.
- Non-admins get `{}` from enrich (no admin fields required).

Frontend auth type — Snowman:  
`D:\SmartServeStudios\LoadPilotSnowman\frontend\src\lib\auth-context.tsx`  
Target: `{TARGET_ROOT}\frontend\src\lib\auth-context.tsx`

Add optional fields: `adminRoleId`, `adminRoleName`, `adminPageKeys`, `isFullAdmin`.

Post-login redirect for admins remains `/admin` (unchanged).

### Phase 4 checklist

- [ ] Full admin session has `isFullAdmin: true` and full `adminPageKeys`  
- [ ] Role-based admin session has subset keys + `overview`  
- [ ] Non-admin login payload unchanged for shipper/carrier  

---

## 9. Phase 5 — Admin roles / users / pages APIs

Search Snowman `D:\SmartServeStudios\LoadPilotSnowman\backend\src\routes.ts` for `assertAdminPageAccess`, `/api/admin/roles`, `/api/admin/pages`, `/api/admin/users`.  
Helpers: `D:\SmartServeStudios\LoadPilotSnowman\backend\src\admin-permissions.ts`

### 9.1 `assertAdminPageAccess`

```ts
// requireAuth already applied; then:
// 1) load user; must be role === "admin"
// 2) resolveAdminPageKeys(user)
// 3) hasAdminPageAccess(pageKeys, pageKey) or 403
```

### 9.2 Endpoints to port/merge

| Method | Path | Page key | Notes |
|--------|------|----------|-------|
| GET | `/api/admin/pages` | any admin | Assignable pages catalog |
| GET | `/api/admin/roles` | `admin_roles` | List + assigned counts |
| GET | `/api/admin/roles/assignable` | `users` | Filtered by actor’s key subset |
| POST | `/api/admin/roles` | `admin_roles` | ≥1 page key; no escalation |
| PATCH | `/api/admin/roles/:id` | `admin_roles` | Name/desc/keys; no escalation |
| DELETE | `/api/admin/roles/:id` | `admin_roles` | Fail if users still assigned |
| GET/POST/PATCH | `/api/admin/users` (+ `/:id`) | `users` | Support `adminRoleId`; null = full admin |

### 9.3 Privilege rules (must preserve)

1. Creating/updating a role: page keys must be a subset of actor’s keys (full admin = all).
2. Assigning a role to a user: `assertAdminCanAssignRole(actor, targetRole)`.
3. Setting `adminRoleId: null` = promote/keep as full admin.
4. `adminRoleId` only valid when `role === "admin"`.
5. Unique role `name`; return clear 400 on duplicate.

### Phase 5 checklist

- [ ] Full admin can CRUD all roles  
- [ ] Role-based admin without `admin_roles` cannot open roles API  
- [ ] Role-based admin cannot grant pages they lack  
- [ ] Delete role in use → 400  
- [ ] Users list returns `adminRoleId` / `adminRoleName` / `isFullAdmin`  

---

## 10. Phase 6 — Frontend gates, sidebar, routes, i18n

| Snowman absolute path | Target destination |
|-----------------------|--------------------|
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\hooks\use-admin-access.ts` | `{TARGET_ROOT}\frontend\src\hooks\use-admin-access.ts` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\admin-access-gate.tsx` | `{TARGET_ROOT}\frontend\src\components\admin-access-gate.tsx` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\app-sidebar.tsx` | Merge into `{TARGET_ROOT}\frontend\src\components\app-sidebar.tsx` |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\App.tsx` | Merge into `{TARGET_ROOT}\frontend\src\App.tsx` |

### App routing merges

1. Wrap admin tree with `<AdminAccessGate>` around `/admin/*`
2. Register `/admin/roles`
3. Denied mapped page → redirect `/admin` + toast
4. Non-admin hitting `/admin/*` → `/auth` (or target’s auth route)

### Admin sidebar RBAC

- Each item has `pageKey`
- Fleet section uses `pageKeys: [...FLEET_PAGE_KEYS]` (show section if any key allowed)
- Filter with `filterAdminNavItems(adminItems, hasPage)` (or equivalent)

### Styles

No separate RBAC stylesheet. Match target shadcn/Tailwind:

- Full Admin badge: `text-red-600 border-red-400`
- Role-based badge: `text-violet-600 border-violet-400`

### i18n

Merge from Snowman `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\i18n\locales\en.json` (and other locales if target has them):

- `nav.adminRoles`
- Any missing `titleKey` strings referenced by `ADMIN_PAGES`
- Optional: `roles.adminConsole` if used on roles page

### Phase 6 checklist

- [ ] Role-based admin only sees allowed nav items  
- [ ] Direct URL to denied page redirects to `/admin`  
- [ ] Full admin sees full nav  

---

## 11. Phase 7 — Admin roles UI + users assignment UI

| Snowman absolute path | Route / purpose |
|-----------------------|-----------------|
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\roles.tsx` | `/admin/roles` — create/edit/delete roles + page checkboxes |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\users.tsx` | Merge Full vs Role-based admin assignment |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\lib\admin-data-store.tsx` | Merge only if target uses the same store pattern |

**Roles page behavior:**

- List roles with page chips + assigned admin count
- Create/edit: name, description, assignable page checkboxes (exclude `overview`)
- Delete disabled/blocked when assigned count > 0

**Users page merge (additive only):**

- When creating/editing an admin: choose Full Admin (`adminRoleId = null`) or pick from `/api/admin/roles/assignable`
- Show Full / Role-based badges
- Do **not** replace the entire users page

### Phase 7 checklist

- [ ] Full admin can create a limited role and assign it  
- [ ] Assigned admin’s sidebar/pages match role keys  
- [ ] Clearing role on user restores full admin access after re-login/me refresh  

---

## 12. End-to-end flows (acceptance)

### Flow A — Create role-based admin (happy path)

```
Full admin opens /admin/roles
  → Creates role with subset of page_keys (e.g. load_queue, reports)
  → Opens /admin/users
  → Creates or edits admin user with that adminRoleId
  → Role-based admin logs in → /admin
  → Sidebar shows overview + granted pages only
  → Direct navigation to denied page → redirect /admin + access denied toast
```

### Flow B — No escalation

```
Role-based admin with admin_roles + users pages
  → Tries to create/assign a role including pages they lack
  → API returns 403
```

### Flow C — Delete safeguards

```
Role assigned to ≥1 admin
  → DELETE /api/admin/roles/:id → 400
  → After reassigning all users away → delete succeeds
```

### Flow D — Do not break

```
Existing full admins (admin_role_id null)
  → Still see all admin pages
  → Shipper/carrier portals unchanged
```

---

## 13. File inventory (absolute Snowman paths)

### Backend

| Snowman absolute path | Action |
|-----------------------|--------|
| `D:\SmartServeStudios\LoadPilotSnowman\backend\migrations\0011_admin_roles.sql` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\shared\admin-pages.ts` | Port + adapt paths |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\admin-permissions.ts` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\shared\schema.ts` | Merge admin roles + `users.adminRoleId` |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\storage.ts` | Merge role CRUD + count |
| `D:\SmartServeStudios\LoadPilotSnowman\backend\src\routes.ts` | Merge pages/roles/users + `enrichAdminSessionUser` + `assertAdminPageAccess` |

### Frontend

| Snowman absolute path | Action |
|-----------------------|--------|
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\shared\admin-pages.ts` | Port (sync with backend) |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\shared\schema.ts` | Merge if present |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\hooks\use-admin-access.ts` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\admin-access-gate.tsx` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\roles.tsx` | Port |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\pages\admin\users.tsx` | Merge role assignment |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\components\app-sidebar.tsx` | Merge `pageKey` / fleet filter |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\App.tsx` | Merge gate + `/admin/roles` route |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\lib\auth-context.tsx` | Merge admin session fields |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\lib\admin-data-store.tsx` | Merge if used |
| `D:\SmartServeStudios\LoadPilotSnowman\frontend\src\i18n\locales\en.json` | Merge nav/role keys |

Every write goes to the matching path under `{TARGET_ROOT}\...` using the **full absolute target path**.

---

## 14. Conflict avoidance playbook

| Situation | Safe approach |
|-----------|---------------|
| Need a Snowman snippet | Open full path under `D:\SmartServeStudios\LoadPilotSnowman\...` |
| Need to edit target | Open full path under `{TARGET_ROOT}\...` |
| Huge diverged `routes.ts` | Search symbols; port roles/users/pages blocks; never overwrite whole file |
| Target admin URLs differ | Adapt `path` in both `admin-pages.ts` copies; keep keys |
| Target already has crude admin roles | Diff carefully; prefer Snowman page-key model over inventing a second system |
| Auth differs (JWT vs session) | Keep target auth; add enrichment fields to login/me payload |
| Users page heavily customized | Merge assignment controls only; do not replace page |
| Also need driver portal | Follow parent guide Feature A separately after/before RBAC |

---

## 15. Known Snowman caveats (RBAC)

1. Most `/api/admin/*` APIs are role-admin only, **not** page-key gated — UI gate is primary.
2. Some unmapped admin URLs (`pathnameToAdminPageKey` → `null`) bypass page-key denial.
3. Overview widgets are not filtered by `hasPage`.
4. Prefer admin-created admins only (avoid public `role=admin` register).
5. If a role row is deleted while still referenced, FK behavior depends on DB constraint — Snowman blocks delete when in use; keep that guard.
6. Frontend and backend page catalogs must stay in sync or gates silently disagree.

---

## 16. Minimal smoke test script

1. Migrate DB; start API + UI from `{TARGET_ROOT}`.
2. Existing full admin (`admin_role_id` null) → previous admin pages still work.
3. Create role with subset of pages at `/admin/roles`.
4. Assign that role to an admin at `/admin/users`.
5. Log in as role-based admin → nav/pages filtered; denied URL redirects to `/admin`.
6. Attempt escalate (grant extra page / assign richer role) → 403.
7. Attempt delete role still in use → 400.
8. Clear `adminRoleId` (full admin again) → all pages return after session refresh.
9. Shipper + carrier flows still work (unaffected).

---

## 17. Prompt template for the integrating Cursor

```text
Integrate Load Pilot Snowman ROLE-BASED ADMIN (page-key RBAC) into the TARGET
Load Pilot on this PC.

SOURCE_ROOT (read-only):
D:\SmartServeStudios\LoadPilotSnowman

GUIDE (follow exactly):
D:\SmartServeStudios\LoadPilotSnowman\ROLE_BASED_ADMIN_MIGRATION_GUIDE.md

TARGET_ROOT (write here — local only, not GitHub):
<<< PASTE ABSOLUTE PATH OF TARGET LOAD PILOT >>>

Feature:
Role-based admin — admin_roles + users.admin_role_id + page-key RBAC,
session enrichment, AdminAccessGate, sidebar filter, /admin/roles + users UI.

Product rules:
- Full admin = users.admin_role_id IS NULL (all ADMIN_PAGE_KEYS).
- Role-based admin = admin_role_id → admin_roles.page_keys + always "overview".
- Keep backend/frontend admin-pages.ts in sync; adapt paths to target URLs; keep keys stable.
- No privilege escalation beyond actor's page keys.
- Cannot delete a role still assigned to users.
- Frontend is the primary page gate; backend page-key checks mainly on users/roles APIs.
- Use FULL absolute Windows paths for every file read/write.
- Additive merges only; never replace schema.ts, routes.ts, or App.tsx wholesale.
- Do not break shipper/carrier/full-admin existing logic.
- Work phase by phase; after each phase summarize absolute paths touched and risks.

Out of scope unless separately requested:
- Driver portal / Feature A (see SNOWMAN_INTEGRATION_GUIDE.md)
```

---

## 18. Quick reference — symbols to search in Snowman

Search inside `D:\SmartServeStudios\LoadPilotSnowman`:

```
enrichAdminSessionUser
assertAdminPageAccess
assertAdminCanAssignRole
hasAdminPageAccess
resolveAdminPageKeys
isFullAdmin
isAdminUser
AdminAccessGate
useAdminAccess
filterAdminNavItems
pathnameToAdminPageKey
ADMIN_PAGE_KEYS
ASSIGNABLE_ADMIN_PAGES
FLEET_PAGE_KEYS
OVERVIEW_PAGE_KEY
admin_roles
adminRoleId
/api/admin/roles
/api/admin/pages
/api/admin/roles/assignable
```

When in doubt, open the matching file under  
`D:\SmartServeStudios\LoadPilotSnowman\...`  
by full path, port the smallest coherent block, then merge into  
`{TARGET_ROOT}\...`  
by full path.
