"use client";

import React from "react";
import { motion } from "framer-motion";

interface ProgressSectionProps {
  progress: {
    current: number;
    total: number;
  };
  isProcessing: boolean;
}

export const ProgressSection: React.FC<ProgressSectionProps> = ({ progress, isProcessing }) => {
  if (!isProcessing) return null;

  return (
    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 backdrop-blur-md">
      <div className="flex justify-between items-end mb-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary">Matching Progress</p>
          <p className="text-2xl font-bold">{Math.round((progress.current / progress.total) * 100) || 0}%</p>
        </div>
        <p className="text-sm text-zinc-500 font-medium">
          {progress.current} / {progress.total} items
        </p>
      </div>
      <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${(progress.current / progress.total) * 100}%` }}
        />
      </div>
    </div>
  );
};
