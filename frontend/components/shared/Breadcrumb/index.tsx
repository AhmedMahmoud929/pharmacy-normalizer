"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { motion } from "framer-motion";
import {
  dashboardNavItems,
  getDashboardBreadcrumbs,
} from "@/lib/nav-items";

const crumbBoxClass =
  "inline-flex min-w-0 max-w-full items-center rounded border border-border bg-card px-1.5 py-0.5 text-10 font-semibold uppercase tracking-wide transition-colors";

const separatorClass =
  "mx-1.5 shrink-0 text-14 font-semibold text-muted-foreground rtl:rotate-180";

export function Breadcrumb() {
  const tNav = useTranslations("Navigation");
  const tCrumb = useTranslations("breadcrumb");
  const pathname = usePathname();

  const { crumbs } = getDashboardBreadcrumbs(pathname);

  const getTranslatedLabel = (label: string) => {
    const navItem = dashboardNavItems.find((item) => item.name === label);
    if (navItem && tNav.has(navItem.key)) {
      return tNav(navItem.key);
    }
    const key = label.toLowerCase().replace(/\s+/g, "_");
    if (tNav.has(key)) {
      return tNav(key);
    }
    return label;
  };

  const breadcrumbItems = [
    {
      label: tCrumb("dashboard"),
      href: "/dashboard/matcher",
    },
    ...crumbs.map((crumb) => ({
      label: getTranslatedLabel(crumb.label),
      href: crumb.href,
    })),
  ];

  const shouldShowDropdown = breadcrumbItems.length > 4;
  const visibleItems = shouldShowDropdown
    ? [breadcrumbItems[0], ...breadcrumbItems.slice(-2)]
    : breadcrumbItems;
  const hiddenItems = shouldShowDropdown ? breadcrumbItems.slice(1, -2) : [];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-label="Breadcrumb navigation"
    >
      <div className="flex flex-1 items-center px-2.5">
        <ol className="flex min-w-0 items-center">
          {visibleItems.map((item, index) => {
            const isLast = index === visibleItems.length - 1;
            const actualIndex =
              shouldShowDropdown && index > 0
                ? breadcrumbItems.length - (visibleItems.length - index)
                : index;

            return (
              <motion.li
                key={`${item.label}-${index}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: actualIndex * 0.1 }}
                className="flex min-w-0 items-center"
              >
                {shouldShowDropdown && index === 1 && (
                  <>
                    <span className={separatorClass} aria-hidden="true">
                      /
                    </span>
                    <div className="relative group">
                      <button
                        type="button"
                        className={`${crumbBoxClass} gap-1 text-muted-foreground hover:border-primary/40 hover:text-primary`}
                        aria-label="Show hidden breadcrumb segments"
                      >
                        <span>…</span>
                      </button>
                      <div className="invisible absolute start-0 top-full z-10 mt-1 min-w-48 rounded-lg border border-border bg-popover py-1 opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:opacity-100">
                        {hiddenItems.map((hiddenItem) =>
                          hiddenItem.href ? (
                            <Link
                              key={hiddenItem.href}
                              href={hiddenItem.href}
                              className="block px-3 py-2 text-14 font-semibold uppercase tracking-wide text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-primary"
                            >
                              {hiddenItem.label}
                            </Link>
                          ) : (
                            <span
                              key={hiddenItem.label}
                              className="block px-3 py-2 text-14 font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              {hiddenItem.label}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}

                {((shouldShowDropdown && index > 1) ||
                  (!shouldShowDropdown && index > 0)) && (
                  <span className={separatorClass} aria-hidden="true">
                    /
                  </span>
                )}

                {isLast || !item.href ? (
                  <span
                    className={`${crumbBoxClass} text-primary border-primary`}
                    aria-current="page"
                  >
                    <span className="truncate">{item.label}</span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className={`${crumbBoxClass} text-muted-foreground hover:border-primary/40 hover:text-primary`}
                  >
                    <span className="truncate">{item.label}</span>
                  </Link>
                )}
              </motion.li>
            );
          })}
        </ol>
      </div>
    </motion.nav>
  );
}
