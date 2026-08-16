"use client";

import React, { useState } from "react";
import { Globe, Radar } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { FeatureBadge } from "@/components/shared/FeatureBadge";
import { SourceProfilesPanel } from "@/components/discovery/SourceProfilesPanel";
import { DiscoveryJobsPanel } from "@/components/discovery/DiscoveryJobsPanel";

type Tab = "sources" | "jobs";

export default function DiscoveryDashboard() {
  const t = useTranslations("Discovery");
  const tDash = useTranslations("Dashboard");
  const [tab, setTab] = useState<Tab>("jobs");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <FeatureBadge icon={Radar} label={tDash("badge_discovery")} />
          <h1 className="text-2xl font-bold tracking-tight mt-2">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex rounded-lg border border-border p-1 bg-muted/30">
          <button
            type="button"
            onClick={() => setTab("jobs")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              tab === "jobs" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Radar className="h-4 w-4" />
            {t("tab_jobs")}
          </button>
          <button
            type="button"
            onClick={() => setTab("sources")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              tab === "sources" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe className="h-4 w-4" />
            {t("tab_sources")}
          </button>
        </div>
      </div>

      {tab === "sources" ? <SourceProfilesPanel /> : <DiscoveryJobsPanel />}
    </div>
  );
}
