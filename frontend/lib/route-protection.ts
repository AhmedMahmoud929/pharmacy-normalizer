import { routing } from "@/i18n/routing";
import type { AuthPayload } from "@/lib/auth-server";
import {
  canAccessDashboardPath,
  defaultDashboardRoute,
} from "@/lib/permissions";

export type RouteDecision =
  | { type: "continue" }
  | { type: "redirect"; pathname: string };

export function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || "/";
    }
  }
  return pathname;
}

export function localePrefix(pathname: string): string {
  return pathname.startsWith("/ar") ? "/ar" : "";
}

function isDashboardPath(path: string): boolean {
  return path === "/dashboard" || path.startsWith("/dashboard/");
}

export function evaluateRouteAccess(
  path: string,
  session: AuthPayload | null
): RouteDecision {
  const isLogin = path === "/login";
  const isRoot = path === "/";
  const isDashboard = isDashboardPath(path);

  if ((isDashboard || isRoot) && !session) {
    return { type: "redirect", pathname: "/login" };
  }

  if (isLogin && session) {
    const destination = defaultDashboardRoute(session);
    if (destination !== "/login") {
      return { type: "redirect", pathname: destination };
    }
  }

  if (isRoot && session) {
    return { type: "redirect", pathname: defaultDashboardRoute(session) };
  }

  if (isDashboard && session) {
    const normalized = path.replace(/\/+$/, "") || "/";

    if (normalized === "/dashboard") {
      return { type: "redirect", pathname: defaultDashboardRoute(session) };
    }

    if (!canAccessDashboardPath(session, path)) {
      const destination = defaultDashboardRoute(session);
      return { type: "redirect", pathname: destination };
    }
  }

  return { type: "continue" };
}
