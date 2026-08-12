import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { verifyAccessToken } from "./lib/auth-server";
import { permissionForDashboardPath } from "./lib/permissions";

const intlMiddleware = createMiddleware(routing);

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || "/";
    }
  }
  return pathname;
}

function localePrefix(pathname: string): string {
  return pathname.startsWith("/ar") ? "/ar" : "";
}

function sessionHasPermission(
  session: NonNullable<Awaited<ReturnType<typeof verifyAccessToken>>>,
  permission: string
): boolean {
  if (session.role === "admin") return true;
  return (session.permissions ?? []).includes(permission);
}

function defaultRouteForSession(
  session: NonNullable<Awaited<ReturnType<typeof verifyAccessToken>>>
): string {
  const order = [
    "/dashboard/matcher",
    "/dashboard/enrichment",
    "/dashboard/catalog",
    "/dashboard/crawler",
    "/dashboard/browse",
    "/dashboard/gallery",
    "/dashboard/search",
    "/dashboard/normalize",
    "/dashboard/admin/users",
  ];
  for (const route of order) {
    const perm = permissionForDashboardPath(route);
    if (perm && sessionHasPermission(session, perm)) return route;
  }
  return "/login";
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const path = stripLocale(pathname);
  const prefix = localePrefix(pathname);

  const rawToken = request.cookies.get("pharmatch_token")?.value;
  const token = rawToken ? decodeURIComponent(rawToken) : null;
  const session = token ? await verifyAccessToken(token) : null;

  const isLogin = path === "/login";
  const isDashboard = path.startsWith("/dashboard");
  const isRoot = path === "/";

  if ((isDashboard || isRoot) && !session) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/login`;
    return NextResponse.redirect(url);
  }

  if (isLogin && session) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${defaultRouteForSession(session)}`;
    return NextResponse.redirect(url);
  }

  if (isRoot && session) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${defaultRouteForSession(session)}`;
    return NextResponse.redirect(url);
  }

  if (isDashboard && session) {
    const required = permissionForDashboardPath(path);
    if (required && !sessionHasPermission(session, required)) {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix}${defaultRouteForSession(session)}`;
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/(ar|en)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
