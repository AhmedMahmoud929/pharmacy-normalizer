"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { ApiStatusBadge } from "@/components/layout/ApiStatusBadge";
import LanguageSwitcher from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { UserMenu } from "./UserMenu";

export function DashboardHeader() {
  return (
    <header className="flex items-center gap-3 border-b border-border h-16 px-4 md:px-6 lg:px-8 bg-background sticky top-0 z-30 shrink-0">
      <div className="min-w-0 flex-1">
        <Breadcrumb />
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <ApiStatusBadge />
        <ThemeSwitcher />
        <LanguageSwitcher />
        <UserMenu />

        <div className="lg:hidden">
          <Sidebar />
        </div>
      </div>
    </header>
  );
}
