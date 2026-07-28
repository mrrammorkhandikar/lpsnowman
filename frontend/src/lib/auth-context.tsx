import { createContext, useContext, useState, useEffect } from "react";
import type { User, UserRole } from "@/shared/schema";
import { queryClient } from "./queryClient";
import { apiGet, apiPost, parseJsonResponse } from "./api-client";

interface AuthUser extends Omit<User, "password" | "adminRoleId"> {
  role: UserRole;
  carrierType?: "enterprise" | "solo";
  /** Fleet driver record id (role=driver), from login / auth/me */
  driverId?: string;
  /** Role-based admin: assigned admin role id (null = full admin) */
  adminRoleId?: string | null;
  adminRoleName?: string | null;
  adminPageKeys?: string[];
  isFullAdmin?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggingOut: boolean;
  carrierType: "enterprise" | "solo" | undefined;
  login: (username: string, password: string) => Promise<boolean>;
  register: (userData: { username: string; email?: string; password: string; role: UserRole; companyName?: string; companyAddress?: string; defaultPickupCity?: string; phone?: string; carrierType?: string; city?: string; otpId?: string; addressState?: string; addressPostalCode?: string; addressCountry?: string; addressCity?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  refreshUser: () => Promise<void>;
  /** Set the authenticated user directly from an existing API response (avoids an extra /api/auth/me round-trip). */
  setUserDirectly: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function initialAuthLoading(): boolean {
  if (typeof window === "undefined") return true;
  const p = window.location.pathname;
  return p !== "/auth" && p !== "/";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(initialAuthLoading);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    void checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check localStorage for dummy driver first
      const storedUser = localStorage.getItem("auth_user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as AuthUser;
          // If it's a dummy driver, restore it directly
          if (parsedUser.role === "driver" && parsedUser.id === "driver-001") {
            setUser(parsedUser);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          // Invalid JSON, continue with API check
        }
      }

      const response = await apiGet("api/auth/me", { timeoutMs: 5000 });
      if (response.ok) {
        const data = await parseJsonResponse<{ user: AuthUser }>(response);
        setUser(data.user);
      } else if (response.status === 401) {
        // Not authenticated - this is expected on first load
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Check for dummy driver login first
      const dummyDriver = dummyDriverLogin(username, password);
      if (dummyDriver) {
        queryClient.clear();
        setUser(dummyDriver);
        // Persist dummy driver to localStorage
        localStorage.setItem("auth_user", JSON.stringify(dummyDriver));
        return true;
      }

      const response = await apiPost("api/auth/login", { username, password });
      if (response.ok) {
        const data = await parseJsonResponse<{ user: AuthUser }>(response);
        // Clear any stale cached data from previous session
        queryClient.clear();
        setUser(data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const register = async (userData: { username: string; email?: string; password: string; role: UserRole; companyName?: string; companyAddress?: string; defaultPickupCity?: string; phone?: string; carrierType?: string; city?: string; otpId?: string; addressState?: string; addressPostalCode?: string; addressCountry?: string; addressCity?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiPost("api/auth/register", userData);
      const data = await parseJsonResponse<{ user?: AuthUser; error?: string }>(response);
      if (response.ok && data.user) {
        // Clear any stale cached data from previous session
        queryClient.clear();
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Registration failed" };
    } catch (error) {
      console.error("Registration failed:", error);
      return { success: false, error: "Something went wrong. Please try again." };
    }
  };

  // Dummy driver login for demo purposes
  const dummyDriverLogin = (username: string, password: string): AuthUser | null => {
    // Dummy credentials: driver / driver123
    if (username === "driver" && password === "driver123") {
      return {
        id: "driver-001",
        username: "Rajesh Kumar",
        email: "rajesh@example.com",
        role: "driver",
        companyName: "Independent Driver",
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  };

  const logout = () => {
    setIsLoggingOut(true);
    // Invalidate server session without blocking the UI (bounded timeout).
    void apiPost("api/auth/logout", undefined, { timeoutMs: 3500 }).catch(() => {});
    queryClient.clear();
    localStorage.removeItem("auth_user");
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith("rating_pending_")) {
        sessionStorage.removeItem(key);
      }
    });
    setUser(null);
    window.setTimeout(() => setIsLoggingOut(false), 500);
  };

  const switchRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  const refreshUser = async () => {
    try {
      const response = await apiGet("api/auth/me", { timeoutMs: 5000 });
      if (response.ok) {
        const data = await parseJsonResponse<{ user: AuthUser }>(response);
        setUser(data.user);
      } else if (response.status === 401) {
        // Session expired
        setUser(null);
      }
    } catch (error) {
      console.error("User refresh failed:", error);
    }
  };

  const setUserDirectly = (u: AuthUser) => {
    queryClient.clear();
    setUser(u);
  };

  const carrierType = user?.carrierType;

  return (
    <AuthContext.Provider value={{ user, isLoading, isLoggingOut, carrierType, login, register, logout, switchRole, refreshUser, setUserDirectly }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
