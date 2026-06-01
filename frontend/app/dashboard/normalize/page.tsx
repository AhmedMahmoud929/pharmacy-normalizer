"use client";

import React, { useState } from "react";
import { FileText, Play, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/lib/utils";

export default function NormalizePage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleNormalize = async () => {
    if (!input) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/normalize?q=${encodeURIComponent(input)}`);
      const data = await res.json();
      setResult(data.normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pt-12 pb-32 space-y-12">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Normalization <span className="text-primary">Lab</span>
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl">
          Test the Drug Matcher's core normalization pipeline. Input any raw product name (including Arabic)
          to see how the engine cleans, translates, and tokenizes it.
        </p>
      </div>

      <div className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-8">
        <div className="space-y-4">
          <label className="text-sm font-bold uppercase tracking-wider text-zinc-500">Input Product Name</label>
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. LAROCHE POSAY REDERMIC RETINOL 15ML OR بنادول ادفانس 24 قرص"
              className="w-full h-32 p-4 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none text-lg"
            />
            <button
              disabled={isLoading || !input}
              onClick={handleNormalize}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {isLoading ? "Processing..." : "Normalize"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 pt-8 border-t border-zinc-100 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold uppercase tracking-wider text-zinc-500">Output Result</label>
                <div className="flex items-center gap-2 text-success text-xs font-bold">
                  <Check className="w-4 h-4" />
                  Successfully Normalized
                </div>
              </div>
              <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between group">
                <span className="text-xl font-bold text-primary tracking-tight">{result}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(result)}
                  className="text-xs font-bold text-zinc-400 hover:text-primary transition-colors uppercase tracking-widest"
                >
                  Copy to Clipboard
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Pipeline</span>
                  <p className="text-xs text-zinc-500 font-medium">Cleaning &gt; Arabic Translation &gt; Unit Processing &gt; Token Reordering</p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Engine Status</span>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <p className="text-xs text-zinc-500 font-bold">Turbo v9.0.2 Optimized</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
