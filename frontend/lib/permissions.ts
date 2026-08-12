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
  "users",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  matcher: "Match Sheet",
  enrichment: "Barcode Enrichment",
  catalog: "Catalog Seeder",
  crawler: "Campaign Crawler",
  browse: "Browse DB",
  gallery: "Media Gallery",
  search: "Global Search",
  normalize: "Normalize",
  users: "User Management",
};

export function effectivePermissions(user: {
  role?: string;
  permissions?: string[];
} | null | undefined): Permission[] {
  if (!user) return [];
  if (user.role === "admin") return [...ALL_PERMISSIONS];
  const granted = user.permissions ?? [];
  return ALL_PERMISSIONS.filter((p) => granted.includes(p));
}

export function hasPermission(
  user: { role?: string; permissions?: string[] } | null | undefined,
  permission: Permission
): boolean {
  return effectivePermissions(user).includes(permission);
}

export const ROUTE_PERMISSION: Record<string, Permission> = {
  "/dashboard/matcher": "matcher",
  "/dashboard/enrichment": "enrichment",
  "/dashboard/catalog": "catalog",
  "/dashboard/crawler": "crawler",
  "/dashboard/browse": "browse",
  "/dashboard/gallery": "gallery",
  "/dashboard/search": "search",
  "/dashboard/normalize": "normalize",
  "/dashboard/admin/users": "users",
};

export function permissionForDashboardPath(path: string): Permission | null {
  for (const [prefix, permission] of Object.entries(ROUTE_PERMISSION)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return permission;
    }
  }
  return null;
}

export function defaultDashboardRoute(
  user: { role?: string; permissions?: string[] } | null | undefined
): string {
  for (const permission of ALL_PERMISSIONS) {
    if (permission === "users") continue;
    if (hasPermission(user, permission)) {
      const route = Object.entries(ROUTE_PERMISSION).find(([, p]) => p === permission);
      if (route) return route[0];
    }
  }
  if (hasPermission(user, "users")) return "/dashboard/admin/users";
  return "/login";
}
