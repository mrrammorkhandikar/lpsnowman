import { useEffect, useRef } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { pathnameToAdminPageKey } from "@/shared/admin-pages";
import { useToast } from "@/hooks/use-toast";

/** Blocks role-based admins from admin routes they are not allowed to access. */
export function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { hasPage } = useAdminAccess();
  const [location] = useLocation();
  const { toast } = useToast();
  const lastDeniedRef = useRef<string | null>(null);

  const isAdminRoute = location.startsWith("/admin");
  const pageKey = isAdminRoute ? pathnameToAdminPageKey(location) : null;
  const denied =
    isAdminRoute &&
    user?.role === "admin" &&
    pageKey !== null &&
    !hasPage(pageKey);

  useEffect(() => {
    if (!denied || lastDeniedRef.current === location) return;
    lastDeniedRef.current = location;
    toast({
      title: "Access denied",
      description: "Your admin role does not include this page.",
      variant: "destructive",
    });
  }, [denied, location, toast]);

  if (isAdminRoute) {
    if (!user || user.role !== "admin") {
      return <Redirect to="/auth" />;
    }
    if (denied) {
      return <Redirect to="/admin" />;
    }
  }

  return <>{children}</>;
}
