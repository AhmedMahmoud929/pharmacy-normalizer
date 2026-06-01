"use client";

import React, { useState, useEffect } from "react";
import { Search, X, Loader2, Check, Package, Tag, Layers, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/lib/utils";

interface ManualMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalName: string;
  onSelect: (product: any, variant: any) => void;
}

export const ManualMatchModal: React.FC<ManualMatchModalProps> = ({ isOpen, onClose, originalName, onSelect }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuery(originalName);
      performSearch(originalName);
    }
  }, [isOpen, originalName]);

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/match?q=${encodeURIComponent(searchTerm)}&top=10`);
      const data = await res.json();
      setResults(data.results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Manual Product Selection</h2>
            <p className="text-xs text-zinc-500">Mapping: <span className="text-primary italic">"{originalName}"</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Refine search..."
              className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </form>

          <div className="h-[400px] overflow-y-auto pr-2 scrollbar-thin">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Searching Master DB...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-3">
                {results.map((res, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelect(res.product_data, res.variant_data)}
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-transparent hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                  >
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                        <img src={res.image} alt={res.name_en} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase">
                            {Math.round(res.score * 100)}% Match
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">SKU: {res.sku}</span>
                        </div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate leading-tight">
                          {res.name_en}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                           <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500">
                             <Tag className="w-3 h-3" />
                             {res.product_data?.brand?.name || "No Brand"}
                           </div>
                           <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500">
                             <Layers className="w-3 h-3" />
                             {res.product_data?.category?.name || "Uncategorized"}
                           </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center pr-2">
                        <ArrowRight className="w-5 h-5 text-zinc-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center space-y-2 opacity-50">
                <Search className="w-10 h-10" />
                <p className="text-sm font-medium">No products found</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
