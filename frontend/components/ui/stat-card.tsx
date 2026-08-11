import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared surface used by stat cards and dashboard table panels */
export const cardSurfaceClass =
  "rounded-2xl bg-card border border-border backdrop-blur-sm";

export const tablePanelClass = cn(cardSurfaceClass, "overflow-hidden");

export const tableHeaderClass =
  "text-xs font-bold text-muted-foreground uppercase bg-muted/40 border-b border-border";

export const tableRowClass =
  "border-b border-border last:border-0 hover:bg-muted/30 transition-colors";

export interface StatCardProps {
  label: string;
  value?: string | number | null;
  icon: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
  className?: string;
}

function formatStatValue(value: string | number | null | undefined): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  iconClassName,
  valueClassName,
  className,
}) => {
  return (
    <div className={cn(cardSurfaceClass, "p-5 md:p-6 min-w-0", className)}>
      <Icon className={cn("w-5 h-5 mb-3", iconClassName ?? "text-primary")} />
      <p className={cn("text-2xl font-bold font-mono text-start", valueClassName)}>
        {formatStatValue(value)}
      </p>
      <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold text-start">
        {label}
      </p>
    </div>
  );
};

export const StatCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn(cardSurfaceClass, "p-5 animate-pulse", className)}>
    <div className="w-5 h-5 mb-3 rounded bg-muted" />
    <div className="h-8 w-20 rounded bg-muted" />
    <div className="h-3 w-24 rounded bg-muted mt-2" />
  </div>
);

export const StatCardGrid: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}>{children}</div>
);
