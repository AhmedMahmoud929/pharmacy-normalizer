"use client";

import React from "react";
import { Globe, Radar, FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { FeatureBadge } from "@/components/shared/FeatureBadge";

export default function DiscoveryLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Discovery");
  const tDash = useTranslations("Dashboard");
  const pathname = usePathname();

  const jobsActive = pathname.startsWith("/dashboard/discovery/jobs");
  const tryActive = pathname.startsWith("/dashboard/discovery/try");
  const sourcesActive = pathname.startsWith("/dashboard/discovery/sources");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <FeatureBadge icon={Radar} label={tDash("badge_discovery")} />
          <h1 className="text-2xl font-bold tracking-tight mt-2">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex rounded-lg border border-border p-1 bg-muted/30">
          <Link
            href="/dashboard/discovery/jobs"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              jobsActive ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Radar className="h-4 w-4" />
            {t("tab_jobs")}
          </Link>
          <Link
            href="/dashboard/discovery/try"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              tryActive ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FlaskConical className="h-4 w-4" />
            {t("tab_try")}
          </Link>
          <Link
            href="/dashboard/discovery/sources"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              sourcesActive ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe className="h-4 w-4" />
            {t("tab_sources")}
          </Link>
        </div>
      </div>

      {children}
    </div>
  );
}
