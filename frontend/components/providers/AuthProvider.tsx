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
  setAuthSession,
} from "@/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

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
    const uninstall = installAuthFetchPatch();
    refresh().finally(() => setLoading(false));
    return uninstall;
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginRequest(email, password);
      setAuthSession(data.access_token);
      setUser(data.user);
      router.replace("/dashboard/matcher");
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
      isAdmin: user?.role === "admin",
      login,
      logout,
      refresh,
    }),
    [user, loading, login, logout, refresh]
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
