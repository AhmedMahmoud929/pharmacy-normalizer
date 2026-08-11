import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureBadgeProps {
  icon: LucideIcon;
  label: string;
  className?: string;
}

export function FeatureBadge({ icon: Icon, label, className }: FeatureBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-4",
        className
      )}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{label}</span>
    </div>
  );
}
