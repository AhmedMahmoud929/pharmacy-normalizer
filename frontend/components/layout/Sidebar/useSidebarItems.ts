"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import {
  dashboardNavItems,
  adminNavItems,
  isNavItemActive,
  showCrawler,
} from "@/lib/nav-items";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Permission } from "@/lib/permissions";

export type SidebarNavItem = {
  labelKey: string;
  icon: string;
  path: string;
  permission: Permission;
};

export type SidebarSection = {
  titleKey: string;
  items: SidebarNavItem[];
};

const ICON_BY_KEY: Record<string, string> = {
  match_sheet: "solar:document-text-linear",
  barcode_enrichment: "solar:qr-code-linear",
  catalog_seeder: "solar:leaf-linear",
  campaign_crawler: "solar:code-linear",
  browse_db: "solar:database-linear",
  media_gallery: "solar:gallery-linear",
  global_search: "solar:magnifer-linear",
  normalize: "solar:text-linear",
  user_management: "solar:users-group-two-rounded-linear",
};

export function useSidebarItems() {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  const allItems = [...dashboardNavItems, ...adminNavItems].filter(
    (item) => hasPermission(item.permission)
  );

  const items: SidebarNavItem[] = allItems.map((item) => ({
    labelKey: item.key,
    icon: ICON_BY_KEY[item.key] ?? "solar:widget-linear",
    path: item.href,
    permission: item.permission,
  }));

  const filtered = showCrawler
    ? items
    : items.filter((item) => item.path !== "/dashboard/crawler");

  const workspaceItems = filtered.filter((item) => item.permission !== "users");
  const adminItems = filtered.filter((item) => item.permission === "users");

  const sidebarItems: SidebarSection[] = [
    { titleKey: "workspace", items: workspaceItems },
    ...(adminItems.length ? [{ titleKey: "administration", items: adminItems }] : []),
  ];

  const isActiveStartsWith = ({ path }: { path: string }) =>
    isNavItemActive(pathname, path);

  const getLabel = (labelKey: string) =>
    t.has(labelKey) ? t(labelKey) : labelKey;

  return { sidebarItems, isActiveStartsWith, getLabel, t };
}
