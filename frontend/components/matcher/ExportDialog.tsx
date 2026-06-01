"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Download, 
  Settings, 
  Database, 
  Check, 
  Filter, 
  BarChart3, 
  Zap,
  Package,
  Image as ImageIcon,
  AlertCircle
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  results: any[];
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose, results }) => {
  // Filters State
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["matched", "review", "no_match"]);
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [hasImageOnly, setHasImageOnly] = useState(false);
  const [hasSkuOnly, setHasSkuOnly] = useState(false);

  // Derived filtered results
  const filteredResults = useMemo(() => {
    return results.filter(res => {
      const topMatch = res.matches[0];
      const status = topMatch?.status || "no_match";
      const score = (topMatch?.score || 0) * 100;
      
      const statusMatch = selectedStatuses.includes(status);
      const scoreMatch = score >= minScore && score <= maxScore;
      const imageMatch = !hasImageOnly || !!(topMatch?.image || topMatch?.product_data?.image);
      const skuMatch = !hasSkuOnly || !!topMatch?.sku;

      return statusMatch && scoreMatch && imageMatch && skuMatch;
    });
  }, [results, selectedStatuses, minScore, maxScore, hasImageOnly, hasSkuOnly]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const handleExportEnhance = () => {
    if (filteredResults.length === 0) return;

    const exportData = [...filteredResults].sort((a, b) => a.row_index - b.row_index).map(res => {
      const topMatch = res.matches[0];
      return {
        "Row #": res.row_index + 1,
        "Original Name": res.original_name,
        "Normalized Name": res.normalized_name,
        "Status": topMatch?.status || "no_match",
        "Score": topMatch ? (topMatch.score * 100).toFixed(2) + "%" : "0%",
        "Matched Name": topMatch?.name_en || "",
        "Matched SKU": topMatch?.sku || "",
        "DB Normalized Name": topMatch?.db_normalized || "",
        "Jaccard Score": topMatch?.jaccard != null ? (topMatch.jaccard * 100).toFixed(2) + "%" : "",
        "Sequence Score": topMatch?.sequence != null ? (topMatch.sequence * 100).toFixed(2) + "%" : "",
        "Matched Tokens": Array.isArray(topMatch?.matched_tokens) ? topMatch.matched_tokens.join(", ") : "",
        "Unmatched Query Tokens": Array.isArray(topMatch?.unmatched_query_tokens) ? topMatch.unmatched_query_tokens.join(", ") : "",
        "Unmatched DB Tokens": Array.isArray(topMatch?.unmatched_db_tokens) ? topMatch.unmatched_db_tokens.join(", ") : "",
        "Candidate Count": topMatch?.candidate_count ?? 0,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Enhancement Results");
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(workbook, `drug_matcher_enhance_${timestamp}.xlsx`);
  };

  const handleExportProduction = (format: 'csv' | 'json') => {
    if (filteredResults.length === 0) return;

    const storefrontData = filteredResults.map(res => {
      const match = res.matches[0];
      const p = match?.product_data || {};
      const v = match?.variant_data || {};

      return {
        id: v.id || p.id || match?.id || "",
        sku: v.sku || p.sku || match?.sku || "",
        name_en: v.name_en || p.name_en || match?.name_en || "",
        name_ar: v.name_ar || p.name_ar || "",
        slug: p.slug || "",
        image: v.image || p.image || match?.image || "",
        price: v.price || p.price || 0,
        discount_price: v.discount_price || p.discount_price || null,
        stock: v.stock || p.stock || 0,
        category: p.category?.name || "",
        brand: p.brand?.name || "",
        need_prescription: p.need_prescription ? "Yes" : "No"
      };
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(storefrontData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `production_catalog_${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(storefrontData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Storefront Catalog");
      XLSX.writeFile(workbook, `production_catalog_${timestamp}.xlsx`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl bg-white dark:bg-zinc-950 rounded-3xl border border-primary/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Enhanced Export</h2>
                  <p className="text-sm text-zinc-500 font-medium">Configure filters and choose export mode</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-8">
              {/* Filters Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-primary">
                  <Filter className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Global Filters</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Status Filter */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-foreground">Match Status</label>
                    <div className="flex flex-wrap gap-2">
                      {["matched", "review", "no_match"].map((status) => (
                        <button
                          key={status}
                          onClick={() => toggleStatus(status)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2",
                            selectedStatuses.includes(status)
                              ? "bg-primary/10 border-primary/30 text-primary shadow-sm"
                              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 opacity-60 hover:opacity-100"
                          )}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            status === "matched" ? "bg-success" : status === "review" ? "bg-warning" : "bg-error"
                          )} />
                          {status.replace("_", " ").toUpperCase()}
                          {selectedStatuses.includes(status) && <Check className="w-3 h-3 ml-1" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Score Filter */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-foreground">Confidence Score Range</label>
                      <span className="text-xs font-mono text-primary font-bold">{minScore}% - {maxScore}%</span>
                    </div>
                    <div className="flex items-center gap-4 px-2 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={minScore}
                        onChange={(e) => setMinScore(Number(e.target.value))}
                        className="flex-1 accent-primary h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-pointer"
                      />
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={maxScore}
                        onChange={(e) => setMaxScore(Number(e.target.value))}
                        className="flex-1 accent-primary h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setHasImageOnly(!hasImageOnly)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      hasImageOnly ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", hasImageOnly ? "bg-primary/20 text-primary" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400")}>
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground">Has Image Only</p>
                        <p className="text-[10px] text-zinc-500 font-medium">Only items with visual data</p>
                      </div>
                    </div>
                    <div className={cn(
                      "w-10 h-6 rounded-full p-1 transition-colors",
                      hasImageOnly ? "bg-primary" : "bg-zinc-200 dark:bg-zinc-800"
                    )}>
                      <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", hasImageOnly ? "translate-x-4" : "translate-x-0")} />
                    </div>
                  </button>

                  <button
                    onClick={() => setHasSkuOnly(!hasSkuOnly)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      hasSkuOnly ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", hasSkuOnly ? "bg-primary/20 text-primary" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400")}>
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground">Has SKU Only</p>
                        <p className="text-[10px] text-zinc-500 font-medium">Only items with system identifier</p>
                      </div>
                    </div>
                    <div className={cn(
                      "w-10 h-6 rounded-full p-1 transition-colors",
                      hasSkuOnly ? "bg-primary" : "bg-zinc-200 dark:bg-zinc-800"
                    )}>
                      <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", hasSkuOnly ? "translate-x-4" : "translate-x-0")} />
                    </div>
                  </button>
                </div>
              </section>

              {/* Export Modes Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-primary">
                  <Settings className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Choose Export Mode</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Enhance Mode */}
                  <div className="group p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 hover:border-primary/30 transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="p-3 bg-primary/10 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                        <BarChart3 className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Export for Enhancing</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                          Includes raw data + technical metrics (Jaccard, Sequence, Tokens). 
                          Perfect for AI analysis and finding matching gaps.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleExportEnhance}
                      disabled={filteredResults.length === 0}
                      className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      Download Enhance Pack
                    </button>
                  </div>

                  {/* Production Mode */}
                  <div className="group p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 hover:border-primary/30 transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="p-3 bg-primary/10 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                        <Database className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Export for Production</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                          Clean customer-facing data with images and SKUs. 
                          Optimized for storefront ingestion and bulk updates.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleExportProduction('csv')}
                        disabled={filteredResults.length === 0}
                        className="py-3 bg-primary text-white rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => handleExportProduction('json')}
                        disabled={filteredResults.length === 0}
                        className="py-3 bg-primary/10 text-primary border border-primary/20 rounded-2xl font-bold text-sm hover:bg-primary/20 transition-all disabled:opacity-50"
                      >
                        JSON
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Footer Status */}
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {filteredResults.length === 0 ? (
                  <div className="flex items-center gap-2 text-error animate-pulse">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-bold">No results found for current filters</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-success">
                    <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Ready to Export: <span className="text-sm ml-1">{filteredResults.length} items</span>
                    </span>
                  </div>
                )}
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Real-time Data Processing
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
