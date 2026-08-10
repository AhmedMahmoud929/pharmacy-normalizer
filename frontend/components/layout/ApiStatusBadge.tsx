"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/utils";

type ApiStatus = "loading" | "online" | "offline";

export const ApiStatusBadge: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("loading");
  const t = useTranslations("Dashboard");

  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        setApiStatus(res.ok ? "online" : "offline");
      } catch {
        setApiStatus("offline");
      }
    };
    checkApi();
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-sidebar-accent rounded-lg border border-sidebar-border">
      <div
        className={`w-2 h-2 rounded-full animate-pulse ${
          apiStatus === "online"
            ? "bg-success"
            : apiStatus === "loading"
              ? "bg-warning"
              : "bg-error"
        }`}
      />
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-sans">
        {apiStatus === "online"
          ? t("api_status_online")
          : apiStatus === "loading"
            ? t("api_status_connecting")
            : t("api_status_offline")}
      </span>
    </div>
  );
};

