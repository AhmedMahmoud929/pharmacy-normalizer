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
  useUploadedStock: boolean;
  setUseUploadedStock: (val: boolean) => void;
  stockColumn: string;
  setStockColumn: (col: string) => void;
  defaultStock: number;
  setDefaultStock: (val: number) => void;
  useUploadedCode: boolean;
  setUseUploadedCode: (val: boolean) => void;
  codeColumn: string;
  setCodeColumn: (col: string) => void;
  useUploadedInternationalBarcode: boolean;
  setUseUploadedInternationalBarcode: (val: boolean) => void;
  internationalBarcodeColumn: string;
  setInternationalBarcodeColumn: (col: string) => void;
  matchWithInternationalBarcode: boolean;
  setMatchWithInternationalBarcode: (val: boolean) => void;
  matchInternationalBarcodeColumn: string;
  setMatchInternationalBarcodeColumn: (col: string) => void;
  matchWithCode: boolean;
  setMatchWithCode: (val: boolean) => void;
  matchPosCodeColumn: string;
  setMatchPosCodeColumn: (col: string) => void;
  skipNormalizer: boolean;
  setSkipNormalizer: (val: boolean) => void;
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
  useUploadedStock,
  setUseUploadedStock,
  stockColumn,
  setStockColumn,
  defaultStock,
  setDefaultStock,
  useUploadedCode,
  setUseUploadedCode,
  codeColumn,
  setCodeColumn,
  useUploadedInternationalBarcode,
  setUseUploadedInternationalBarcode,
  internationalBarcodeColumn,
  setInternationalBarcodeColumn,
  matchWithInternationalBarcode,
  setMatchWithInternationalBarcode,
  matchInternationalBarcodeColumn,
  setMatchInternationalBarcodeColumn,
  matchWithCode,
  setMatchWithCode,
  matchPosCodeColumn,
  setMatchPosCodeColumn,
  skipNormalizer,
  setSkipNormalizer,
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

      {/* Uploaded Stock Override */}
      <div className="pt-4 border-t border-primary/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-neutral-gray">Use Uploaded Stock</label>
            <span className="text-[10px] text-zinc-400">Override catalog stock with sheet data</span>
          </div>
          <button
            onClick={() => setUseUploadedStock(!useUploadedStock)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              useUploadedStock ? "bg-primary" : "bg-neutral-gray/20"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                useUploadedStock ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        <AnimatePresence>
          {useUploadedStock && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <label className="text-xs font-medium text-neutral-gray block">Select Stock Column</label>
              <select
                value={stockColumn}
                onChange={(e) => setStockColumn(e.target.value)}
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

        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-gray block">Default Stock</label>
          <input
            type="number"
            min="0"
            value={defaultStock}
            onChange={(e) => setDefaultStock(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full p-3 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
          />
        </div>
      </div>

      {/* Uploaded Code */}
      <div className="pt-4 border-t border-primary/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-neutral-gray">Use Uploaded Code</label>
            <span className="text-[10px] text-zinc-400">Extract product code from sheet data</span>
          </div>
          <button
            onClick={() => setUseUploadedCode(!useUploadedCode)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              useUploadedCode ? "bg-primary" : "bg-neutral-gray/20"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                useUploadedCode ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        <AnimatePresence>
          {useUploadedCode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <label className="text-xs font-medium text-neutral-gray block">Select Code Column</label>
              <select
                value={codeColumn}
                onChange={(e) => setCodeColumn(e.target.value)}
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

      {/* Uploaded International Barcode */}
      <div className="pt-4 border-t border-primary/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-neutral-gray">Use Uploaded International Barcode</label>
            <span className="text-[10px] text-zinc-400">Extract international barcode from sheet data</span>
          </div>
          <button
            onClick={() => setUseUploadedInternationalBarcode(!useUploadedInternationalBarcode)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              useUploadedInternationalBarcode ? "bg-primary" : "bg-neutral-gray/20"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                useUploadedInternationalBarcode ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        <AnimatePresence>
          {useUploadedInternationalBarcode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <label className="text-xs font-medium text-neutral-gray block">Select International Barcode Column</label>
              <select
                value={internationalBarcodeColumn}
                onChange={(e) => setInternationalBarcodeColumn(e.target.value)}
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

      {/* Match with International Barcode */}
      <div className="pt-4 border-t border-primary/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-neutral-gray">Match with International Barcode</label>
            <span className="text-[10px] text-zinc-400">Fast exact lookup by barcode before name matching</span>
          </div>
          <button
            onClick={() => setMatchWithInternationalBarcode(!matchWithInternationalBarcode)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              matchWithInternationalBarcode ? "bg-primary" : "bg-neutral-gray/20"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                matchWithInternationalBarcode ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        <AnimatePresence>
          {matchWithInternationalBarcode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <label className="text-xs font-medium text-neutral-gray block">Select International Barcode Column</label>
              <select
                value={matchInternationalBarcodeColumn}
                onChange={(e) => setMatchInternationalBarcodeColumn(e.target.value)}
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

      {/* Match with POS Code */}
      <div className="pt-4 border-t border-primary/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-neutral-gray">Match with POS Code</label>
            <span className="text-[10px] text-zinc-400">Fast exact lookup by product code before name matching</span>
          </div>
          <button
            onClick={() => setMatchWithCode(!matchWithCode)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              matchWithCode ? "bg-primary" : "bg-neutral-gray/20"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                matchWithCode ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        <AnimatePresence>
          {matchWithCode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <label className="text-xs font-medium text-neutral-gray block">Select POS Code Column</label>
              <select
                value={matchPosCodeColumn}
                onChange={(e) => setMatchPosCodeColumn(e.target.value)}
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

      {/* Skip Normalizer */}
      <div className="pt-4 border-t border-primary/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-neutral-gray">Skip Normalizer (Text Search)</label>
            <span className="text-[10px] text-zinc-400">Only search by international barcode or code</span>
          </div>
          <button
            onClick={() => setSkipNormalizer(!skipNormalizer)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              skipNormalizer ? "bg-primary" : "bg-neutral-gray/20"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                skipNormalizer ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
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
        className="w-full py-4 bg-primary hover:bg-primary-dark text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
      >
        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
        {isProcessing ? "Processing Rows..." : "Start Matching"}
      </button>
    </motion.div>
  );
};
