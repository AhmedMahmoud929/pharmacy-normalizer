/** Shared permission definitions for the dashboard. */

export const ALL_PERMISSIONS = [
  "matcher",
  "enrichment",
  "catalog",
  "crawler",
  "browse",
  "gallery",
  "search",
  "normalize",
  "discovery",
  "users",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export type PermissionUser = {
  role?: string;
  permissions?: string[];
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  matcher: "Match Sheet",
  enrichment: "Barcode Enrichment",
  catalog: "Catalog Seeder",
  crawler: "Campaign Crawler",
  browse: "Browse DB",
  gallery: "Media Gallery",
  search: "Global Search",
  normalize: "Normalize",
  discovery: "Product Discovery",
  users: "User Management",
};

export function effectivePermissions(user: PermissionUser | null | undefined): Permission[] {
  if (!user) return [];
  if (user.role === "admin") return [...ALL_PERMISSIONS];
  const granted = user.permissions ?? [];
  return ALL_PERMISSIONS.filter((p) => granted.includes(p));
}

export function hasPermission(
  user: PermissionUser | null | undefined,
  permission: Permission
): boolean {
  return effectivePermissions(user).includes(permission);
}

export const ROUTE_PERMISSION: Record<string, Permission> = {
  "/dashboard/admin/users": "users",
  "/dashboard/admin": "users",
  "/dashboard/matcher": "matcher",
  "/dashboard/enrichment": "enrichment",
  "/dashboard/discovery": "discovery",
  "/dashboard/catalog": "catalog",
  "/dashboard/crawler": "crawler",
  "/dashboard/browse": "browse",
  "/dashboard/gallery": "gallery",
  "/dashboard/search": "search",
  "/dashboard/normalize": "normalize",
};

const ROUTE_PERMISSION_ENTRIES = Object.entries(ROUTE_PERMISSION).sort(
  ([a], [b]) => b.length - a.length
);

const showCrawler = process.env.NEXT_PUBLIC_ENABLE_CRAWLER === "true";

function normalizeDashboardPath(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}

export function permissionForDashboardPath(path: string): Permission | null {
  const normalized = normalizeDashboardPath(path);
  if (normalized === "/dashboard") return null;

  for (const [prefix, permission] of ROUTE_PERMISSION_ENTRIES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return permission;
    }
  }

  return null;
}

export function canAccessDashboardPath(
  user: PermissionUser | null | undefined,
  path: string
): boolean {
  const normalized = normalizeDashboardPath(path);

  if (normalized === "/dashboard") return true;

  if (normalized.startsWith("/dashboard/crawler") && !showCrawler) {
    return false;
  }

  const required = permissionForDashboardPath(normalized);
  if (required === null) {
    return !normalized.startsWith("/dashboard/");
  }

  return hasPermission(user, required);
}

export function defaultDashboardRoute(user: PermissionUser | null | undefined): string {
  for (const permission of ALL_PERMISSIONS) {
    if (permission === "users") continue;
    if (permission === "crawler" && !showCrawler) continue;
    if (hasPermission(user, permission)) {
      const route = Object.entries(ROUTE_PERMISSION).find(([, p]) => p === permission);
      if (route) return route[0];
    }
  }
  if (hasPermission(user, "users")) return "/dashboard/admin/users";
  return "/login";
}
