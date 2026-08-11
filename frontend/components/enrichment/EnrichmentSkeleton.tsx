import React from "react";
import {
  StatCardGrid,
  StatCardSkeleton,
  tablePanelClass,
  tableHeaderClass,
} from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

export function EnrichmentSkeleton() {
  return (
    <div className="w-full space-y-6">
      <StatCardGrid className="gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <StatCardSkeleton key={idx} />
        ))}
      </StatCardGrid>

      <div className={cn(tablePanelClass, "w-full animate-pulse")}>
        <div className="space-y-4 border-b border-border bg-muted/30 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-7 w-16 rounded-full bg-zinc-300 dark:bg-zinc-800" />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-20 rounded bg-zinc-300 dark:bg-zinc-800" />
              <div className="h-10 w-64 rounded-xl bg-zinc-200 dark:bg-zinc-900" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className={tableHeaderClass}>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Sheet product</th>
                <th className="px-3 py-3">Sheet barcode</th>
                <th className="px-3 py-3">DB product</th>
                <th className="px-3 py-3">DB barcode</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className="border-b border-border/40">
                  <td className="px-3 py-3">
                    <div className="h-3 w-6 rounded bg-zinc-300 dark:bg-zinc-800" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-2">
                      <div className="h-4 w-3/4 rounded bg-zinc-300 dark:bg-zinc-800" />
                      <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-900" />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-3 w-28 rounded bg-zinc-300 dark:bg-zinc-800" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-2">
                      <div className="h-4 w-4/5 rounded bg-zinc-300 dark:bg-zinc-800" />
                      <div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-900" />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-3 w-24 rounded bg-zinc-300 dark:bg-zinc-800" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-6 w-16 rounded-md bg-zinc-300 dark:bg-zinc-800" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <div className="h-8 w-20 rounded-lg bg-zinc-300 dark:bg-zinc-800" />
                      <div className="h-8 w-14 rounded-lg bg-zinc-200 dark:bg-zinc-900" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function EnrichmentHistorySkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-2">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-4 py-2">
          <div className="h-4 flex-1 rounded bg-zinc-300 dark:bg-zinc-800" />
          <div className="h-5 w-16 rounded-full bg-zinc-300 dark:bg-zinc-800" />
          <div className="h-4 w-10 rounded bg-zinc-200 dark:bg-zinc-900" />
          <div className="h-4 w-10 rounded bg-zinc-200 dark:bg-zinc-900" />
          <div className="h-4 w-10 rounded bg-zinc-200 dark:bg-zinc-900" />
          <div className="h-4 w-28 rounded bg-zinc-300 dark:bg-zinc-800" />
          <div className="h-4 w-12 rounded bg-zinc-300 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
