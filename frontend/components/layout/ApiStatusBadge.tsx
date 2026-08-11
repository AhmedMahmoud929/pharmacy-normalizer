"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { API_URL, cn } from "@/lib/utils";

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

  const label =
    apiStatus === "online"
      ? t("api_status_online")
      : apiStatus === "loading"
        ? t("api_status_connecting")
        : t("api_status_offline");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`API ${label}`}
          className="relative"
        >
          <Icon icon="solar:server-linear" className="size-4.5 shrink-0" />
          <span
            className={cn(
              "absolute top-1.5 end-1.5 size-2 rounded-full",
              apiStatus === "online"
                ? "bg-success"
                : apiStatus === "loading"
                  ? "bg-warning"
                  : "bg-error"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-44 p-3 bg-popover border border-border rounded-2xl shadow-xl"
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full animate-pulse",
              apiStatus === "online"
                ? "bg-success"
                : apiStatus === "loading"
                  ? "bg-warning"
                  : "bg-error"
            )}
          />
          <span className="text-12 font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
};
