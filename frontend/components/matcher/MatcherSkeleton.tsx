import React from "react";
import { Image as ImageIcon } from "lucide-react";

export const MatcherSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 w-full">
      {/* Skeleton Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 animate-pulse">
        {/* Match Rate (2 columns) */}
        <div className="p-4 h-24 rounded-2xl bg-zinc-200/40 dark:bg-zinc-900/40 border border-zinc-200/10 dark:border-zinc-800/40 col-span-1 sm:col-span-2 lg:col-span-2 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 bg-zinc-300 dark:bg-zinc-700 rounded w-16" />
            <div className="h-6 bg-zinc-300 dark:bg-zinc-700 rounded w-24" />
          </div>
          <div className="w-10 h-10 bg-zinc-300 dark:bg-zinc-700 rounded-xl animate-pulse" />
        </div>

        {/* 4 other stats cards */}
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="p-4 h-24 rounded-2xl bg-zinc-200/25 dark:bg-zinc-900/25 border border-zinc-200/10 dark:border-zinc-800/40 flex items-center justify-between">
            <div className="space-y-2 w-full">
              <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-20" />
              <div className="h-6 bg-zinc-300 dark:bg-zinc-800 rounded w-12" />
            </div>
            <div className="w-8 h-8 bg-zinc-350 dark:bg-zinc-800 rounded-lg opacity-30 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Skeleton Table */}
      <div className="rounded-2xl border border-primary/20 bg-white/30 dark:bg-black/30 backdrop-blur-md overflow-hidden flex flex-col h-[750px] w-full animate-pulse">
        {/* Controls skeleton */}
        <div className="p-4 border-b border-primary/20 bg-primary/5 space-y-4">
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
            <thead className="sticky top-0 bg-zinc-100/50 dark:bg-zinc-950/50 backdrop-blur-md z-10">
              <tr className="text-xs font-bold text-zinc-400 uppercase">
                <th className="p-4 border-b border-primary/10 w-[80px]">Row</th>
                <th className="p-4 border-b border-primary/10 w-[80px]">Image</th>
                <th className="p-4 border-b border-primary/10 w-[25%]">Top Match</th>
                <th className="p-4 border-b border-primary/10 w-[25%]">Original Name</th>
                <th className="p-4 border-b border-primary/10 w-[12%]">Score</th>
                <th className="p-4 border-b border-primary/10 w-[12%]">Status</th>
                <th className="p-4 border-b border-primary/10 w-[12%]">Matching Method</th>
                <th className="p-4 border-b border-primary/10 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className="border-b border-zinc-150/10 dark:border-zinc-800/20">
                  {/* Row */}
                  <td className="p-4">
                    <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded w-8" />
                  </td>
                  {/* Image */}
                  <td className="p-4">
                    <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-850 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-zinc-300 dark:text-zinc-700 animate-pulse" />
                    </div>
                  </td>
                  {/* Top Match */}
                  <td className="p-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-300 dark:bg-zinc-800 rounded w-3/4" />
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-900 rounded w-1/2" />
                    </div>
                  </td>
                  {/* Original Name */}
                  <td className="p-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-300 dark:bg-zinc-800 rounded w-4/5" />
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-900 rounded w-2/3" />
                    </div>
                  </td>
                  {/* Score */}
                  <td className="p-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-300 dark:bg-zinc-800 rounded w-10" />
                      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-900 rounded w-16" />
                    </div>
                  </td>
                  {/* Status */}
                  <td className="p-4">
                    <div className="h-6 bg-zinc-300 dark:bg-zinc-800 rounded-md w-16" />
                  </td>
                  {/* Matching Method */}
                  <td className="p-4">
                    <div className="h-6 bg-zinc-300 dark:bg-zinc-800 rounded-md w-20" />
                  </td>
                  {/* Actions */}
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
