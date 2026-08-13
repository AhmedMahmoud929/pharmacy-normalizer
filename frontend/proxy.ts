import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { verifyAccessToken } from "./lib/auth-server";
import {
  evaluateRouteAccess,
  localePrefix,
  stripLocale,
} from "./lib/route-protection";

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const path = stripLocale(pathname);
  const prefix = localePrefix(pathname);

  const rawToken = request.cookies.get("pharmatch_token")?.value;
  const token = rawToken ? decodeURIComponent(rawToken) : null;
  const session = token ? await verifyAccessToken(token) : null;

  const decision = evaluateRouteAccess(path, session);

  if (decision.type === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${decision.pathname}`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/(ar|en)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
