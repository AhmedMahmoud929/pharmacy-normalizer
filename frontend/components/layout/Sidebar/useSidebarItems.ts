"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { dashboardNavItems, isNavItemActive, showCrawler } from "@/lib/nav-items";

export type SidebarNavItem = {
  labelKey: string;
  icon: string;
  path: string;
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
};

export function useSidebarItems() {
  const t = useTranslations("Navigation");
  const pathname = usePathname();

  const items: SidebarNavItem[] = dashboardNavItems.map((item) => ({
    labelKey: item.key,
    icon: ICON_BY_KEY[item.key] ?? "solar:widget-linear",
    path: item.href,
  }));

  // Ensure crawler stays gated even if nav-items array is imported elsewhere.
  const filtered = showCrawler
    ? items
    : items.filter((item) => item.path !== "/dashboard/crawler");

  const sidebarItems: SidebarSection[] = [
    {
      titleKey: "workspace",
      items: filtered,
    },
  ];

  const isActiveStartsWith = ({ path }: { path: string }) =>
    isNavItemActive(pathname, path);

  const getLabel = (labelKey: string) =>
    t.has(labelKey) ? t(labelKey) : labelKey;

  return { sidebarItems, isActiveStartsWith, getLabel, t };
}
