import { API_URL } from "@/lib/utils";

export const AUTH_TOKEN_KEY = "pharmatch_token";
export const AUTH_COOKIE = "pharmatch_token";
const TOKEN_TTL_HOURS = Number(process.env.NEXT_PUBLIC_JWT_TTL_HOURS || "12");
const TOKEN_MAX_AGE_SECONDS = TOKEN_TTL_HOURS * 3600;

let onUnauthorizedCallback: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorizedCallback = handler;
  return () => {
    onUnauthorizedCallback = null;
  };
}

function loginPath(): string {
  if (typeof window === "undefined") return "/login";
  return window.location.pathname.startsWith("/ar") ? "/ar/login" : "/login";
}

export function handleUnauthorized() {
  if (typeof window === "undefined" || !getStoredToken()) return;

  clearAuthSession();
  onUnauthorizedCallback?.();

  const target = loginPath();
  if (!window.location.pathname.includes("/login")) {
    window.location.href = target;
  }
}

function isAuthApiUrl(url: string): boolean {
  return url.startsWith(API_URL) && !url.includes("/api/auth/login");
}

/** Endpoints that return 401 for wrong password, not expired session. */
const PASSWORD_VERIFICATION_401_PATHS = [
  "/api/db-admin/clean",
  "/api/db-admin/backup/export",
  "/api/db-admin/backup/import",
];

function isPasswordVerification401(url: string, method: string): boolean {
  if (PASSWORD_VERIFICATION_401_PATHS.some((path) => url.includes(path))) {
    return true;
  }

  return (
    method === "DELETE" &&
    /\/api\/matcher\/job\/[^/?#]+$/.test(url.replace(API_URL, ""))
  );
}

function resolveFetchMethod(
  input: RequestInfo | URL,
  init?: RequestInit
): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== "string" && !(input instanceof URL) && "method" in input) {
    return input.method.toUpperCase();
  }
  return "GET";
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  permissions: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthSession(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${TOKEN_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function authHeaders(token?: string | null): HeadersInit {
  const value = token ?? getStoredToken();
  return value ? { Authorization: `Bearer ${value}` } : {};
}

export function authEventSourceUrl(path: string): string {
  const token = getStoredToken();
  const base = path.startsWith("http") ? path : `${API_URL}${path}`;
  if (!token) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}

export async function loginRequest(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Login failed");
  }
  return data as { access_token: string; user: AuthUser };
}

export async function fetchCurrentUser(token?: string | null): Promise<AuthUser | null> {
  const authToken = token ?? getStoredToken();
  if (!authToken) return null;

  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      ...authHeaders(authToken),
    },
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export function installAuthFetchPatch() {
  if (typeof window === "undefined") return () => {};

  const originalFetch = window.fetch.bind(window);
  if ((window.fetch as FetchWithPatchFlag).__authPatched) {
    return () => {};
  }

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    let sentAuth = false;
    if (url.startsWith(API_URL)) {
      const token = getStoredToken();
      if (token) {
        const headers = new Headers(init?.headers);
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
          sentAuth = true;
        } else {
          sentAuth = true;
        }
        init = { ...init, headers };
      }
    }

    const response = await originalFetch(input, init);
    const method = resolveFetchMethod(input, init);

    if (
      isAuthApiUrl(url) &&
      response.status === 401 &&
      sentAuth &&
      !isPasswordVerification401(url, method)
    ) {
      handleUnauthorized();
    }

    return response;
  };

  (window.fetch as FetchWithPatchFlag).__authPatched = true;

  return () => {
    window.fetch = originalFetch;
    delete (window.fetch as FetchWithPatchFlag).__authPatched;
  };
}

type FetchWithPatchFlag = typeof fetch & { __authPatched?: boolean };
