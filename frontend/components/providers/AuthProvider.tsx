"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "@/i18n/navigation";
import {
  AuthUser,
  clearAuthSession,
  fetchCurrentUser,
  getStoredToken,
  installAuthFetchPatch,
  loginRequest,
  registerUnauthorizedHandler,
  setAuthSession,
} from "@/lib/auth";
import {
  defaultDashboardRoute,
  effectivePermissions,
  hasPermission as checkPermission,
  type Permission,
} from "@/lib/permissions";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  permissions: Permission[];
  isAdmin: boolean;
  hasPermission: (permission: Permission) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  if (typeof window !== "undefined") {
    installAuthFetchPatch();
  }

  const permissions = useMemo(() => effectivePermissions(user), [user]);

  const hasPermission = useCallback(
    (permission: Permission) => checkPermission(user, permission),
    [user]
  );

  const refresh = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }
    const me = await fetchCurrentUser(token);
    if (!me) {
      clearAuthSession();
      setUser(null);
      return;
    }
    setUser(me);
  }, []);

  useEffect(() => {
    installAuthFetchPatch();
    const unregisterUnauthorized = registerUnauthorizedHandler(() => setUser(null));
    refresh().finally(() => setLoading(false));
    return () => {
      unregisterUnauthorized();
    };
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginRequest(email, password);
      setAuthSession(data.access_token);
      setUser(data.user);
      router.replace(defaultDashboardRoute(data.user));
    },
    [router]
  );

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      loading,
      permissions,
      isAdmin: user?.role === "admin",
      hasPermission,
      login,
      logout,
      refresh,
    }),
    [user, loading, permissions, hasPermission, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
