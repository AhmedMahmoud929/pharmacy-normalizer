import React from "react";
import { StatCardGrid, StatCardSkeleton, tablePanelClass, tableHeaderClass } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

export const MatcherSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 w-full">
      <StatCardGrid className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <StatCardSkeleton key={idx} />
        ))}
      </StatCardGrid>

      {/* Skeleton Table */}
      <div className={cn(tablePanelClass, "flex flex-col h-[750px] w-full animate-pulse")}>
        <div className="p-4 border-b border-border bg-muted/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-zinc-300 dark:bg-zinc-750 rounded" />
              <div className="w-32 h-4 bg-zinc-300 dark:bg-zinc-750 rounded" />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-24 h-4 bg-zinc-300 dark:bg-zinc-750 rounded" />
            </div>
          </div>
          <div className="w-full h-10 bg-white dark:bg-zinc-900/80 border border-primary/10 rounded-xl" />
        </div>

        {/* Table skeleton */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-card/95 backdrop-blur-md z-10">
              <tr className={tableHeaderClass}>
                <th className="p-4 border-b border-border w-[80px]">Row</th>
                <th className="p-4 border-b border-border w-[80px]">Image</th>
                <th className="p-4 border-b border-border w-[25%]">Top Match</th>
                <th className="p-4 border-b border-border w-[25%]">Original Name</th>
                <th className="p-4 border-b border-border w-[12%]">Score</th>
                <th className="p-4 border-b border-border w-[12%]">Status</th>
                <th className="p-4 border-b border-border w-[12%]">Matching Method</th>
                <th className="p-4 border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className="border-b border-zinc-150/10 dark:border-zinc-800/20">
                  <td className="p-4">
                    <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-8" />
                  </td>
                  <td className="p-4">
                    <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-850" />
                  </td>
                  <td className="p-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-300 dark:bg-zinc-800 rounded w-3/4" />
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-900 rounded w-1/2" />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-300 dark:bg-zinc-800 rounded w-4/5" />
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-900 rounded w-2/3" />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-300 dark:bg-zinc-800 rounded w-10" />
                      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-900 rounded w-16" />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="h-6 bg-zinc-300 dark:bg-zinc-800 rounded-md w-16" />
                  </td>
                  <td className="p-4">
                    <div className="h-6 bg-zinc-300 dark:bg-zinc-800 rounded-md w-20" />
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-8 h-8 bg-zinc-300 dark:bg-zinc-800 rounded-lg" />
                      <div className="w-8 h-8 bg-zinc-300 dark:bg-zinc-800 rounded-lg" />
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
};
