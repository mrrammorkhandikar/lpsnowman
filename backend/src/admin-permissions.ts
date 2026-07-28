import type { User, AdminRole } from "@shared/schema";
import {
  ADMIN_PAGE_KEYS,
  OVERVIEW_PAGE_KEY,
  type AdminPageKey,
} from "@shared/admin-pages";
import { storage } from "./storage";

export function isAdminUser(user: Pick<User, "role">): boolean {
  return user.role === "admin";
}

export function isFullAdmin(user: Pick<User, "role" | "adminRoleId">): boolean {
  return isAdminUser(user) && !user.adminRoleId;
}

export function normalizeAssignablePageKeys(keys: string[]): AdminPageKey[] {
  const valid = new Set(ADMIN_PAGE_KEYS);
  return keys.filter(
    (k): k is AdminPageKey =>
      valid.has(k as AdminPageKey) && k !== OVERVIEW_PAGE_KEY,
  );
}

export function withOverviewPageKeys(keys: string[]): string[] {
  const set = new Set(keys);
  set.add(OVERVIEW_PAGE_KEY);
  return Array.from(set);
}

export async function resolveAdminPageKeys(
  user: Pick<User, "role" | "adminRoleId">,
): Promise<string[]> {
  if (!isAdminUser(user)) return [];
  if (isFullAdmin(user)) return [...ADMIN_PAGE_KEYS];
  if (!user.adminRoleId) return [OVERVIEW_PAGE_KEY];

  const role = await storage.getAdminRole(user.adminRoleId);
  if (!role) return [OVERVIEW_PAGE_KEY];
  return withOverviewPageKeys(role.pageKeys || []);
}

export async function resolveAdminRoleName(
  user: Pick<User, "role" | "adminRoleId">,
): Promise<string | null> {
  if (!isAdminUser(user) || isFullAdmin(user) || !user.adminRoleId) return null;
  const role = await storage.getAdminRole(user.adminRoleId);
  return role?.name ?? null;
}

export function hasAdminPageAccess(pageKeys: string[], pageKey: string): boolean {
  if (pageKey === OVERVIEW_PAGE_KEY) return true;
  return pageKeys.includes(pageKey);
}

export function isPageKeySubset(subset: string[], superset: string[]): boolean {
  const allowed = new Set(withOverviewPageKeys(superset));
  return normalizeAssignablePageKeys(subset).every((k) => allowed.has(k));
}

export async function enrichAdminSessionUser(
  user: User,
): Promise<Record<string, unknown>> {
  if (!isAdminUser(user)) return {};
  const [adminPageKeys, adminRoleName] = await Promise.all([
    resolveAdminPageKeys(user),
    resolveAdminRoleName(user),
  ]);
  return {
    adminRoleId: user.adminRoleId ?? null,
    adminRoleName,
    adminPageKeys,
    isFullAdmin: isFullAdmin(user),
  };
}

export async function assertAdminCanAssignRole(
  actor: User,
  targetRole: AdminRole,
): Promise<string | null> {
  if (!isAdminUser(actor)) return "Admin access required";
  if (isFullAdmin(actor)) return null;

  const actorKeys = await resolveAdminPageKeys(actor);
  if (!isPageKeySubset(targetRole.pageKeys || [], actorKeys)) {
    return "You cannot assign a role with more access than your own";
  }
  return null;
}
