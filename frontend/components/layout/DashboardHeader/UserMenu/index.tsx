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
import { useAuth } from "@/components/providers/AuthProvider";

function MenuItem({
  href,
  icon,
  label,
  onClick,
}: {
  href?: string;
  icon: string;
  label: string;
  onClick?: () => void;
}) {
  const className = cn(
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-14 transition-colors text-foreground hover:bg-muted"
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        <Icon icon={icon} className="size-[18px] shrink-0" />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      <Icon icon={icon} className="size-[18px] shrink-0" />
      {label}
    </button>
  );
}

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const t = useTranslations("userMenu");
  const { user, logout, hasPermission } = useAuth();

  const displayName = user?.name?.trim() || user?.email || "User";
  const avatar = initials(user?.name || "", user?.email || "U");

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
              {avatar}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 truncate text-14 font-medium text-foreground sm:block">
            {displayName}
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
              {avatar}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-14 font-medium text-foreground">{displayName}</p>
            <p className="truncate text-12 text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 p-2">
          {hasPermission("users") ? (
            <MenuItem
              href="/dashboard/admin/users"
              icon="solar:users-group-two-rounded-linear"
              label={t("users")}
            />
          ) : null}
          <MenuItem
            icon="solar:logout-2-linear"
            label={t("logout")}
            onClick={logout}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
