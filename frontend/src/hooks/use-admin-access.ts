import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { ADMIN_PAGE_KEYS, OVERVIEW_PAGE_KEY } from "@/shared/admin-pages";

export function useAdminAccess() {
  const { user } = useAuth();

  return useMemo(() => {
    const isAdmin = user?.role === "admin";
    const isFullAdmin = isAdmin && (user?.isFullAdmin ?? !user?.adminRoleId);
    const pageKeys =
      user?.adminPageKeys ??
      (isFullAdmin ? [...ADMIN_PAGE_KEYS] : isAdmin ? [OVERVIEW_PAGE_KEY] : []);

    const hasPage = (pageKey: string) => {
      if (!isAdmin) return false;
      if (pageKey === OVERVIEW_PAGE_KEY) return true;
      if (isFullAdmin) return true;
      return pageKeys.includes(pageKey);
    };

    return {
      isAdmin,
      isFullAdmin,
      pageKeys,
      hasPage,
      adminRoleId: user?.adminRoleId ?? null,
      adminRoleName: user?.adminRoleName ?? null,
    };
  }, [user]);
}
