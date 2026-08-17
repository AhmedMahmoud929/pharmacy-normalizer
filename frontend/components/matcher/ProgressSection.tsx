import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface ProgressSectionProps {
  progress: {
    current: number;
    total: number;
  };
  isProcessing: boolean;
}

export const ProgressSection: React.FC<ProgressSectionProps> = ({ progress, isProcessing }) => {
  if (!isProcessing) return null;

  const isInitializing = progress.total === 0;

  if (isInitializing) {
    return (
      <div className="p-8 rounded-2xl bg-primary/5 border border-primary/20 backdrop-blur-md flex flex-col items-center justify-center text-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <div className="space-y-1">
          <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">Initializing Mapping Process</p>
          <p className="text-xs text-zinc-400 font-medium max-w-sm">
            Uploading your pharmacy sheet, processing column headers, and mapping against our live master product catalog index...
          </p>
        </div>
      </div>
    );
  }

  const percent = Math.round((progress.current / progress.total) * 100) || 0;

  return (
    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 backdrop-blur-md">
      <div className="flex justify-between items-end mb-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary">Matching Progress</p>
          <p className="text-2xl font-bold">{percent}%</p>
        </div>
        <p className="text-sm text-zinc-500 font-medium">
          {progress.current} / {progress.total} items
        </p>
      </div>
      <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
