"use client";

import React from "react";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Menu, X, Sun, Moon, ChevronRight, Languages } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { getDashboardBreadcrumbs, dashboardNavItems } from "@/lib/nav-items";
import { ApiStatusBadge } from "@/components/layout/ApiStatusBadge";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  mobileOpen: boolean;
  onMobileToggle: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  mobileOpen,
  onMobileToggle,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { theme, toggleTheme } = useTheme();
  
  const tNav = useTranslations("Navigation");
  const tDash = useTranslations("Dashboard");

  const { section, crumbs } = getDashboardBreadcrumbs(pathname);

  const getTranslatedLabel = (label: string) => {
    // Check if label matches any of the nav items names
    const navItem = dashboardNavItems.find((item) => item.name === label);
    if (navItem && tNav.has(navItem.key)) {
      return tNav(navItem.key);
    }
    // Check if it matches a known sub-route label
    const key = label.toLowerCase().replace(/\s+/g, "_");
    if (tNav.has(key)) {
      return tNav(key);
    }
    return label;
  };

  const pageTitle = crumbs[crumbs.length - 1]
    ? getTranslatedLabel(crumbs[crumbs.length - 1].label)
    : tDash("title");
    
  const hasSubRoute = crumbs.length > 1;
  const parentCrumbs = hasSubRoute ? crumbs.slice(0, -1) : [];

  const toggleLanguage = () => {
    const nextLocale = locale === "en" ? "ar" : "en";
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 lg:px-6 py-3 border-b border-border bg-background/80 backdrop-blur-lg"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMobileToggle}
          aria-label={mobileOpen ? tDash("close_menu") : tDash("open_menu")}
          className="p-2 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors lg:hidden"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {section && (
          <div
            className={cn(
              "hidden lg:flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
              "bg-primary/10 border border-primary/20 text-primary"
            )}
          >
            <section.icon className="w-4 h-4" />
          </div>
        )}

        <div className="min-w-0">
          {hasSubRoute && parentCrumbs.length > 0 && (
            <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
              {parentCrumbs.map((crumb, index) => (
                <React.Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 && <ChevronRight className="w-3 h-3 shrink-0 opacity-50 rtl:rotate-180" />}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground transition-colors truncate"
                    >
                      {getTranslatedLabel(crumb.label)}
                    </Link>
                  ) : (
                    <span className="truncate">{getTranslatedLabel(crumb.label)}</span>
                  )}
                </React.Fragment>
              ))}
              <ChevronRight className="w-3 h-3 shrink-0 opacity-50 rtl:rotate-180" />
            </nav>
          )}

          <h1 className="text-sm lg:text-base font-semibold text-foreground truncate leading-tight">
            {pageTitle}
          </h1>

          {!hasSubRoute && (
            <p className="text-[10px] lg:text-xs text-muted-foreground truncate">
              {tDash("subtitle")}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={toggleLanguage}
          aria-label="Change language"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-all hover:scale-105 active:scale-95"
        >
          <Languages className="w-4.5 h-4.5 text-primary shrink-0" />
          <span className="font-sans select-none">{locale === "en" ? "العربية" : "English"}</span>
        </button>

        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? tDash("toggle_theme_light") : tDash("toggle_theme_dark")}
          className="p-2 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <ApiStatusBadge />
      </div>
    </header>
  );
};
