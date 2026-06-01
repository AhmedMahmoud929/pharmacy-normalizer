"use client";

import React from "react";
import { BarChart3, CheckCircle2, AlertCircle, X } from "lucide-react";
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
  return (
    <AnimatePresence>
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
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
