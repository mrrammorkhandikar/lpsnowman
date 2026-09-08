/** Canonical admin console pages for role-based access control. */
export const OVERVIEW_PAGE_KEY = "overview" as const;

export const ADMIN_PAGES = [
  { key: "overview", path: "/admin", titleKey: "nav.overview", alwaysGranted: true },
  { key: "post_load", path: "/admin/post-load", titleKey: "nav.postLoad" },
  { key: "load_queue", path: "/admin/queue", titleKey: "nav.loadQueue" },
  { key: "negotiations", path: "/admin/negotiations", titleKey: "nav.bidsNegotiations" },
  { key: "otp_verification", path: "/admin/otp-queue", titleKey: "nav.otpVerification" },
  { key: "live_tracking", path: "/admin/live-tracking", titleKey: "nav.liveTracking" },
  { key: "shipper_onboarding", path: "/admin/onboarding", titleKey: "nav.shipperOnboarding" },
  { key: "invoices", path: "/admin/invoices", titleKey: "nav.memos" },
  { key: "users", path: "/admin/users", titleKey: "nav.users" },
  { key: "admin_roles", path: "/admin/roles", titleKey: "nav.adminRoles" },
  { key: "fleet_add_truck", path: "/admin/fleet/add-truck", titleKey: "nav.addTruck" },
  { key: "fleet", path: "/admin/fleet", titleKey: "nav.myFleet" },
  { key: "drivers", path: "/admin/drivers", titleKey: "nav.myCarriers" },
  { key: "loads", path: "/admin/loads", titleKey: "nav.allLoads" },
  { key: "carriers", path: "/admin/carriers", titleKey: "nav.carriers" },
  { key: "carrier_verification", path: "/admin/verification", titleKey: "nav.verification" },
  { key: "document_review", path: "/admin/finance-review", titleKey: "nav.documentReview" },
  { key: "bc365_sync", path: "/admin/bc365-sync", titleKey: "nav.bc365Sync" },
  { key: "reports", path: "/admin/reports", titleKey: "nav.reports" },
] as const;

export type AdminPageKey = (typeof ADMIN_PAGES)[number]["key"];

export const ADMIN_PAGE_KEYS: AdminPageKey[] = ADMIN_PAGES.map((p) => p.key);

/** Pages that can be assigned to a role (overview is always implicit). */
export const ASSIGNABLE_ADMIN_PAGES = ADMIN_PAGES.filter((p) => p.key !== OVERVIEW_PAGE_KEY);

export const FLEET_PAGE_KEYS = ["fleet", "fleet_add_truck", "drivers"] as const;

export function pathnameToAdminPageKey(pathname: string): AdminPageKey | null {
  if (!pathname.startsWith("/admin")) return null;
  const normalized = pathname.replace(/\/+$/, "") || "/admin";

  if (normalized === "/admin") return OVERVIEW_PAGE_KEY;

  const sorted = [...ADMIN_PAGES]
    .filter((p) => p.path !== "/admin")
    .sort((a, b) => b.path.length - a.path.length);

  for (const page of sorted) {
    if (normalized === page.path || normalized.startsWith(`${page.path}/`)) {
      return page.key;
    }
  }

  return null;
}

export function adminNavItemPageKey(url: string): AdminPageKey | null {
  return pathnameToAdminPageKey(url);
}
