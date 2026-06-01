"use client";

import React from "react";
import { BarChart3, CheckCircle2, AlertCircle, X, Percent } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MatchStatsProps {
  stats: {
    total: number;
    matched: number;
    review: number;
    noMatch: number;
    accuracy: number;
  };
  isComplete: boolean;
}

export const MatchStats: React.FC<MatchStatsProps> = ({ stats, isComplete }) => {
  const matchRate = stats.total > 0 ? (stats.matched / stats.total) * 100 : 0;
  const matchPercentage = matchRate.toFixed(1) + "%";

  return (
    <AnimatePresence>
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4"
        >
          {/* High-importance Accuracy/Match Percentage Card - First Card & 2 Columns Wide */}
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent dark:from-primary/20 dark:via-purple-500/5 dark:to-transparent border border-primary/30 dark:border-primary/40 shadow-lg shadow-primary/5 overflow-hidden flex items-center justify-between col-span-1 sm:col-span-2 lg:col-span-2">
            {/* Subtle background glow decorative circle */}
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
            
            <div className="z-10">
              <p className="text-xs font-semibold text-primary dark:text-purple-400 uppercase tracking-wider">
                Match Rate
              </p>
              <p className="text-2xl font-extrabold mt-1 bg-gradient-to-r from-primary to-purple-500 dark:from-white dark:to-purple-300 bg-clip-text text-transparent tracking-tight">
                {matchPercentage}
              </p>
            </div>
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center z-10">
              <Percent className="w-5 h-5 text-primary dark:text-purple-400 stroke-[3.5]" />
            </div>
          </div>

          {/* Main Stats Card Loop */}
          {[
            { label: "Total Processed", value: stats.total, color: "text-foreground", icon: BarChart3 },
            { label: "Matched", value: stats.matched, color: "text-success", icon: CheckCircle2 },
            { label: "Needs Review", value: stats.review, color: "text-warning", icon: AlertCircle },
            { label: "No Match Found", value: stats.noMatch, color: "text-error", icon: X },
          ].map((s, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white/50 dark:bg-black/50 backdrop-blur-md border border-primary/10 flex items-center justify-between">
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
