"use client";

import React from "react";
import { Play, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MatchConfigProps {
  file: File | null;
  columns: string[];
  selectedColumn: string;
  setSelectedColumn: (col: string) => void;
  matchThreshold: number;
  setMatchThreshold: (val: number) => void;
  reviewThreshold: number;
  setReviewThreshold: (val: number) => void;
  parallel: boolean;
  setParallel: (val: boolean) => void;
  workers: number;
  setWorkers: (val: number) => void;
  isProcessing: boolean;
  onStart: () => void;
  background: boolean;
  setBackground: (val: boolean) => void;
  useUploadedPrice: boolean;
  setUseUploadedPrice: (val: boolean) => void;
  priceColumn: string;
  setPriceColumn: (col: string) => void;
}

export const MatchConfig: React.FC<MatchConfigProps> = ({
  file,
  columns,
  selectedColumn,
  setSelectedColumn,
  matchThreshold,
  setMatchThreshold,
  reviewThreshold,
  setReviewThreshold,
  parallel,
  setParallel,
  workers,
  setWorkers,
  isProcessing,
  onStart,
  background,
  setBackground,
  useUploadedPrice,
  setUseUploadedPrice,
  priceColumn,
  setPriceColumn,
}) => {
  if (!file) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-white/50 dark:bg-black/50 backdrop-blur-md border border-primary/50 shadow-sm space-y-6"
    >
      <div className="space-y-4">
        <label className="text-sm font-medium text-neutral-gray block">Product Name Column</label>
        <select
          value={selectedColumn}
          onChange={(e) => setSelectedColumn(e.target.value)}
          className="w-full p-3 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none"
        >
          {columns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>

      {/* Uploaded Price Override */}
      <div className="pt-4 border-t border-primary/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-neutral-gray">Use Uploaded Prices</label>
            <span className="text-[10px] text-zinc-400">Override default catalog price with sheet data</span>
          </div>
          <button
            onClick={() => setUseUploadedPrice(!useUploadedPrice)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              useUploadedPrice ? "bg-primary" : "bg-neutral-gray/20"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                useUploadedPrice ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        <AnimatePresence>
          {useUploadedPrice && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <label className="text-xs font-medium text-neutral-gray block">Select Price Column</label>
              <select
                value={priceColumn}
                onChange={(e) => setPriceColumn(e.target.value)}
                className="w-full p-3 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none text-sm"
              >
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-neutral-gray">Match Threshold</label>
            <span className="text-sm font-bold text-primary">{matchThreshold}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={matchThreshold}
            onChange={(e) => setMatchThreshold(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-neutral-gray">Review Threshold</label>
            <span className="text-sm font-bold text-warning">{reviewThreshold}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={reviewThreshold}
            onChange={(e) => setReviewThreshold(parseInt(e.target.value))}
            className="w-full accent-warning"
          />
        </div>

        {/* Performance Settings */}
        <div className="pt-4 border-t border-primary/10 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-neutral-gray">Multi-core Processing</label>
            <button
              onClick={() => setParallel(!parallel)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                parallel ? "bg-primary" : "bg-neutral-gray/20"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  parallel ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
          <AnimatePresence>
            {parallel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div className="flex justify-between">
                  <label className="text-xs font-medium text-neutral-gray">CPU Workers</label>
                  <span className="text-xs font-bold text-primary">{workers} Cores</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={workers}
                  onChange={(e) => setWorkers(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Background Toggle */}
        <div className="flex items-center justify-between pt-4 border-t border-primary/10">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-neutral-gray">Run in Background</label>
            <span className="text-[10px] text-zinc-400">Process overnight asynchronously on the server</span>
          </div>
          <button
            onClick={() => setBackground(!background)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              background ? "bg-primary" : "bg-neutral-gray/20"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                background ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </div>

      <button
        disabled={isProcessing || !selectedColumn}
        onClick={onStart}
        className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
      >
        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
        {isProcessing ? "Processing Rows..." : "Start Matching"}
      </button>
    </motion.div>
  );
};
