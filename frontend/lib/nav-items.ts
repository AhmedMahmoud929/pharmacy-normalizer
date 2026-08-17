import {
  Table,
  Search,
  FileText,
  Database,
  Terminal,
  Sprout,
  Barcode,
  Images,
  Users,
  Radar,
  type LucideIcon,
} from "lucide-react";

export const showCrawler = process.env.NEXT_PUBLIC_ENABLE_CRAWLER === "true";

export interface NavItem {
  name: string;
  key: string;
  href: string;
  icon: LucideIcon;
  permission: import("@/lib/permissions").Permission;
}

export const dashboardNavItems: NavItem[] = [
  { name: "Match Sheet", key: "match_sheet", href: "/dashboard/matcher", icon: Table, permission: "matcher" },
  { name: "Barcode Enrichment", key: "barcode_enrichment", href: "/dashboard/enrichment", icon: Barcode, permission: "enrichment" },
  { name: "Product Discovery", key: "product_discovery", href: "/dashboard/discovery/jobs", icon: Radar, permission: "discovery" },
  { name: "Catalog Seeder", key: "catalog_seeder", href: "/dashboard/catalog", icon: Sprout, permission: "catalog" },
  ...(showCrawler
    ? [{ name: "Campaign Crawler", key: "campaign_crawler", href: "/dashboard/crawler", icon: Terminal, permission: "crawler" as const }]
    : []),
  { name: "Browse DB", key: "browse_db", href: "/dashboard/browse", icon: Database, permission: "browse" },
  { name: "Media Gallery", key: "media_gallery", href: "/dashboard/gallery", icon: Images, permission: "gallery" },
  { name: "Global Search", key: "global_search", href: "/dashboard/search", icon: Search, permission: "search" },
  { name: "Normalize", key: "normalize", href: "/dashboard/normalize", icon: FileText, permission: "normalize" },
];

export const adminNavItems: NavItem[] = [
  { name: "User Management", key: "user_management", href: "/dashboard/admin/users", icon: Users, permission: "users" },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SUB_ROUTE_LABELS: Record<string, string> = {
  new: "New Campaign",
  campaigns: "Campaigns",
  explorer: "Explorer",
  admin: "Administration",
  users: "Users",
};

export interface DashboardBreadcrumb {
  label: string;
  href?: string;
}

export function getDashboardBreadcrumbs(pathname: string): {
  section: NavItem | null;
  crumbs: DashboardBreadcrumb[];
} {
  const section = dashboardNavItems.find((item) => isNavItemActive(pathname, item.href));
  if (!section) {
    return { section: null, crumbs: [] };
  }

  const crumbs: DashboardBreadcrumb[] = [{ label: section.name, href: section.href }];

  if (pathname !== section.href) {
    const suffix = pathname.slice(section.href.length + 1);
    const segments = suffix.split("/").filter(Boolean);
    let pathSoFar = section.href;

    for (const segment of segments) {
      pathSoFar += `/${segment}`;
      const label =
        SUB_ROUTE_LABELS[segment] ??
        segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      crumbs.push({ label, href: pathSoFar });
    }

    const last = crumbs[crumbs.length - 1];
    if (last) {
      delete last.href;
    }
  }

  return { section, crumbs };
}
