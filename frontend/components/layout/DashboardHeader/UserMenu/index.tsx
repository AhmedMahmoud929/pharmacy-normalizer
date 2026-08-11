"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function MenuItem({
  href,
  icon,
  label,
}: {
  href?: string;
  icon: string;
  label: string;
}) {
  const className = cn(
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-14 transition-colors text-foreground hover:bg-muted"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        <Icon icon={icon} className="size-[18px] shrink-0" />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" className={className}>
      <Icon icon={icon} className="size-[18px] shrink-0" />
      {label}
    </button>
  );
}

export function UserMenu() {
  const t = useTranslations("userMenu");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 max-w-[220px] gap-2 px-1"
          aria-label={t("menu")}
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary-50 text-12 font-semibold text-primary-500">
              PM
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 truncate text-14 font-medium text-foreground sm:block">
            PharmatchAI
          </span>
          <Icon
            icon="solar:alt-arrow-down-linear"
            className="hidden size-4 shrink-0 text-muted-foreground sm:block"
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" className="w-64 p-0 bg-popover border-border">
        <div className="flex items-center gap-3 border-b border-border px-3 py-3">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary-50 text-12 font-semibold text-primary-500">
              PM
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-14 font-medium text-foreground">
              PharmatchAI
            </p>
            <p className="truncate text-12 text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 p-2">
          <MenuItem href="/" icon="solar:home-2-linear" label={t("home")} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
