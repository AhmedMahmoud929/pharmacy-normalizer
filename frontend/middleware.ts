import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { verifyAccessToken } from "./lib/auth-server";

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
    url.pathname = `${prefix}/dashboard/matcher`;
    return NextResponse.redirect(url);
  }

  if (isRoot && session) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/dashboard/matcher`;
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/dashboard/admin") && session?.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/dashboard/matcher`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/(ar|en)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
