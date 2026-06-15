"use client";

import React from "react";
import { BarChart3, CheckCircle2, AlertCircle, X, Percent, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MatchStatsProps {
  stats: {
    total: number;
    matched: number;
    review: number;
    noMatch: number;
    accuracy: number;
    duration?: number | null;
  };
  isComplete: boolean;
  isProcessing?: boolean;
}

const formatDuration = (seconds?: number | null) => {
  if (seconds == null || isNaN(seconds) || seconds < 0) return "0s";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
};

export const MatchStats: React.FC<MatchStatsProps> = ({ stats, isComplete, isProcessing = false }) => {
  const matchRate = stats.total > 0 ? (stats.matched / stats.total) * 100 : 0;
  const matchPercentage = matchRate.toFixed(1) + "%";

  const showStats = isComplete || isProcessing || stats.total > 0;

  return (
    <AnimatePresence>
      {showStats && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-4"
        >
          {/* Match Rate Card */}
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent dark:from-primary/20 dark:via-purple-500/5 dark:to-transparent border border-primary/30 dark:border-primary/40 shadow-lg shadow-primary/5 overflow-hidden flex items-center justify-between col-span-5">
            <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-primary/25 rounded-full blur-xl pointer-events-none" />
            <div className="z-10">
              <p className="text-xs font-semibold text-primary dark:text-purple-400 uppercase tracking-wider">
                Match Rate
              </p>
              <p className="text-2xl font-extrabold mt-1 bg-gradient-to-r from-primary to-purple-500 dark:from-white dark:to-purple-300 bg-clip-text text-transparent tracking-tight">
                {matchPercentage}
              </p>
            </div>
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center z-10">
              <Percent className="w-4 h-4 text-primary dark:text-purple-400 stroke-[3.5]" />
            </div>
          </div>

          {/* Time Taken / Duration Card */}
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/15 dark:via-blue-500/5 dark:to-transparent border border-blue-500/20 dark:border-blue-500/30 shadow-md flex items-center justify-between col-span-3">
            <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-blue-500/15 rounded-full blur-xl pointer-events-none" />
            <div className="z-10">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                {isProcessing ? "Time Elapsed" : "Time Taken"}
              </p>
              <p className="text-2xl font-extrabold mt-1 text-blue-700 dark:text-blue-300 tracking-tight">
                {formatDuration(stats.duration)}
              </p>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-center z-10">
              <Clock className={cn("w-4 h-4 text-blue-600 dark:text-blue-400", isProcessing && "animate-pulse")} />
            </div>
          </div>

          {/* Main Stats Card Loop */}
          {[
            { label: "Total Processed", value: stats.total, color: "text-foreground", icon: BarChart3 },
            { label: "Matched", value: stats.matched, color: "text-success", icon: CheckCircle2 },
            { label: "Needs Review", value: stats.review, color: "text-warning", icon: AlertCircle },
            { label: "No Match Found", value: stats.noMatch, color: "text-error", icon: X },
          ].map((s, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white/50 dark:bg-black/50 backdrop-blur-md border border-primary/10 flex items-center justify-between col-span-2">
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{s.label}</p>
                <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
              </div>
              <s.icon className={cn("w-8 h-8 opacity-20", s.color)} />
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

