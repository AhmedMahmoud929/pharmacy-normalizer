"use client";

import React from "react";
import { BarChart3, CheckCircle2, AlertCircle, X, Percent, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";

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
        >
          <StatCardGrid className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Match Rate"
              value={matchPercentage}
              icon={Percent}
              iconClassName="text-primary"
              valueClassName="text-primary"
            />
            <StatCard
              label={isProcessing ? "Time Elapsed" : "Time Taken"}
              value={formatDuration(stats.duration)}
              icon={Clock}
              iconClassName="text-sky-400"
              valueClassName="text-sky-400"
            />
            <StatCard
              label="Total Processed"
              value={stats.total}
              icon={BarChart3}
            />
            <StatCard
              label="Matched"
              value={stats.matched}
              icon={CheckCircle2}
              iconClassName="text-success"
              valueClassName="text-success"
            />
            <StatCard
              label="Needs Review"
              value={stats.review}
              icon={AlertCircle}
              iconClassName="text-warning"
              valueClassName="text-warning"
            />
            <StatCard
              label="No Match Found"
              value={stats.noMatch}
              icon={X}
              iconClassName="text-error"
              valueClassName="text-error"
            />
          </StatCardGrid>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
