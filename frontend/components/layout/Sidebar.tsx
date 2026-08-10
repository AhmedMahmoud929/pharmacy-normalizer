"use client";

import React from "react";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { dashboardNavItems, isNavItemActive } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate, className }) => {
  const pathname = usePathname();
  const t = useTranslations("Navigation");

  return (
    <aside
      className={cn(
        "flex flex-col h-full w-64 border-e border-sidebar-border bg-sidebar text-sidebar-foreground",
        className
      )}
    >
      <div className="p-5 border-b border-sidebar-border">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2 group">
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-sidebar-foreground">
              {t("title")}<span className="text-primary">AI</span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest leading-none">
              {t("engine")}
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {dashboardNavItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-sidebar-accent rounded-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <item.icon className="w-4 h-4 relative z-10 shrink-0" />
              <span className="relative z-10">{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Home className="w-4 h-4 shrink-0" />
          <span>{t("home_page")}</span>
        </Link>
      </div>
    </aside>
  );
};

