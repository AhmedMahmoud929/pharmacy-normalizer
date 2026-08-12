"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Menu } from "lucide-react";
import { Icon } from "@iconify/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useSidebarItems,
  type SidebarNavItem,
} from "./useSidebarItems";

export function Sidebar() {
  const t = useTranslations("sidebar");
  const tNav = useTranslations("Navigation");
  const locale = useLocale();
  const isRtl = locale === "ar";

  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { sidebarItems, isActiveStartsWith, getLabel } = useSidebarItems();

  const SidebarContent = ({ collapsible }: { collapsible: boolean }) => (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-4",
          collapsible
            ? isCollapsed
              ? "justify-center"
              : "justify-between gap-3"
            : "justify-center"
        )}
      >
        {(!collapsible || !isCollapsed) && (
          <Link href="/dashboard/matcher" onClick={() => setOpen(false)} className="min-w-0">
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-sidebar-foreground">
                {tNav("title")}
                <span className="text-primary">AI</span>
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest leading-none">
                {tNav("engine")}
              </span>
            </div>
          </Link>
        )}
        {collapsible && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? t("expand") : t("collapse")}
          >
            <ChevronLeft
              className={cn(
                "size-5 transition-transform duration-200",
                isCollapsed && "rotate-180",
                isRtl && !isCollapsed && "rotate-180",
                isRtl && isCollapsed && "rotate-0"
              )}
            />
          </Button>
        )}
      </div>

      <ScrollArea
        className={cn(
          "flex-1 min-h-0",
          "[&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-2"
        )}
      >
        <nav className="space-y-0">
          {sidebarItems.map((section) => (
            <div
              key={section.titleKey}
              className="border-b border-sidebar-border p-3 space-y-2"
            >
              {!isCollapsed && (
                <h2 className="flex items-center px-2 text-[12px] font-normal text-muted-foreground">
                  {t(section.titleKey)}
                </h2>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.path}>
                    <SidebarNavLink
                      item={item}
                      label={getLabel(item.labelKey)}
                      collapsed={collapsible && isCollapsed}
                      isActiveStartsWith={isActiveStartsWith}
                      onItemClick={() => setOpen(false)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          title={tNav("home_page")}
          className={cn(
            "flex h-10 w-full items-center gap-2.5 rounded-md px-3 text-[14px] text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsible && isCollapsed && "justify-center px-0"
          )}
        >
          <Icon
            icon="solar:home-2-linear"
            width={18}
            height={18}
            className="shrink-0 size-[18px]"
          />
          {(!collapsible || !isCollapsed) && <span>{tNav("home_page")}</span>}
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden h-screen flex-col border-e border-sidebar-border bg-sidebar transition-all duration-200 lg:flex",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {SidebarContent({ collapsible: true })}
      </aside>

      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-muted rounded-lg h-8 w-8 lg:h-9 lg:w-9"
              aria-label={t("navigationMenu")}
            >
              <Menu className="h-5 w-5 lg:h-6 lg:w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side={isRtl ? "right" : "left"}
            className="w-72 border-none bg-sidebar p-0"
            showCloseButton={false}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{t("navigationMenu")}</SheetTitle>
            </SheetHeader>
            {SidebarContent({ collapsible: false })}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function SidebarNavLink({
  item,
  label,
  collapsed,
  isActiveStartsWith,
  onItemClick,
}: {
  item: SidebarNavItem;
  label: string;
  collapsed: boolean;
  isActiveStartsWith: (args: { path: string }) => boolean;
  onItemClick: () => void;
}) {
  const active = isActiveStartsWith({ path: item.path });

  return (
    <Link
      title={label}
      href={item.path}
      onClick={onItemClick}
      className={cn(
        "flex h-10 w-full items-center gap-2.5 rounded-md px-3 text-[14px] transition-all duration-200",
        collapsed && "justify-center px-0",
        active
          ? "bg-sidebar-accent text-sidebar-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
      )}
    >
      <Icon
        icon={item.icon}
        width={16}
        height={16}
        className={cn("shrink-0 size-[18px]", active && "text-primary")}
      />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
    </Link>
  );
}
