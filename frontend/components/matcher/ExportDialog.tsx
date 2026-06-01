"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Download, FileSpreadsheet, FileJson, FileText, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  results: any[];
}

type Stage = 1 | 2;
type ExportFormat = "xlsx" | "json" | "txt";
type ExportScope = "all" | "slice";

interface ColumnOption {
  key: string;
  label: string;
}

const columnOptions: ColumnOption[] = [
  { key: "row_index", label: "Row Number" },
  { key: "original_name", label: "Original Product Name" },
  { key: "normalized_name", label: "Normalized Query" },
  { key: "match_status", label: "Match Status" },
  { key: "match_score", label: "Confidence Score" },
  { key: "matched_name_en", label: "Matched Title (EN)" },
  { key: "matched_name_ar", label: "Matched Title (AR)" },
  { key: "matched_sku", label: "Matched SKU" },
  { key: "price", label: "Catalog Retail Price" },
  { key: "brand", label: "Manufacturer Brand" },
  { key: "category", label: "Store Category" },
  { key: "jaccard", label: "Jaccard Token Overlap" },
  { key: "sequence", label: "Sequence Similarity" },
  { key: "matched_tokens", label: "Aligned Tokens" }
];

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  results
}) => {
  const [stage, setStage] = useState<Stage>(1);
  const [format, setFormat] = useState<ExportFormat | null>("xlsx");
  const [scope, setScope] = useState<ExportScope>("all");
  
  // Slicing Range State
  const [offset, setOffset] = useState<number>(0);
  const [limit, setLimit] = useState<number>(100);
  
  // Selected Columns Checklist
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columnOptions.map(o => o.key)
  );

  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  // Set default bounds when results are loaded
  useEffect(() => {
    if (results && results.length > 0) {
      setLimit(results.length);
    }
  }, [results]);

  if (!isOpen) return null;

  const handleToggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const handleSelectAllColumns = () => {
    if (selectedColumns.length === columnOptions.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(columnOptions.map(o => o.key));
    }
  };

  const handleExport = async () => {
    if (!format || results.length === 0 || selectedColumns.length === 0) return;
    setIsExporting(true);
    setExportComplete(false);

    try {
      // Artificially delay slightly to mimic compiling stream UX
      await new Promise(resolve => setTimeout(resolve, 800));

      // Resolve Range Slicing
      let itemsToExport = [...results].sort((a, b) => a.row_index - b.row_index);
      if (scope === "slice") {
        itemsToExport = itemsToExport.slice(offset, offset + limit);
      }

      // Map dynamic row values matching selected columns
      const finalData = itemsToExport.map(res => {
        const topMatch = res.matches?.[0];
        const p = topMatch?.product_data || {};
        const v = topMatch?.variant_data || {};
        
        const record: Record<string, any> = {};
        
        selectedColumns.forEach(fieldId => {
          switch (fieldId) {
            case "row_index":
              record["Row #"] = res.row_index + 1;
              break;
            case "original_name":
              record["Original Name"] = res.original_name;
              break;
            case "normalized_name":
              record["Normalized Name"] = res.normalized_name;
              break;
            case "match_status":
              record["Match Status"] = topMatch?.status || "no_match";
              break;
            case "match_score":
              record["Match Score"] = topMatch ? (topMatch.score * 100).toFixed(1) + "%" : "0%";
              break;
            case "matched_name_en":
              record["Matched Name (EN)"] = topMatch?.name_en || v.name_en || p.name_en || "";
              break;
            case "matched_name_ar":
              record["Matched Name (AR)"] = v.name_ar || p.name_ar || "";
              break;
            case "matched_sku":
              record["Matched SKU"] = topMatch?.sku || v.sku || "";
              break;
            case "price":
              record["Price"] = v.price || p.price || 0;
              break;
            case "brand":
              record["Brand"] = p.brand?.name || "";
              break;
            case "category":
              record["Category"] = p.category?.name || "";
              break;
            case "jaccard":
              record["Jaccard Score"] = topMatch?.jaccard != null ? (topMatch.jaccard * 100).toFixed(1) + "%" : "";
              break;
            case "sequence":
              record["Sequence Score"] = topMatch?.sequence != null ? (topMatch.sequence * 100).toFixed(1) + "%" : "";
              break;
            case "matched_tokens":
              record["Matched Tokens"] = Array.isArray(topMatch?.matched_tokens) ? topMatch.matched_tokens.join(", ") : "";
              break;
            default:
              break;
          }
        });
        
        return record;
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      if (format === 'xlsx') {
        const worksheet = XLSX.utils.json_to_sheet(finalData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Matched Catalog");
        XLSX.writeFile(workbook, `drug_matcher_export_${timestamp}.xlsx`);
      } else if (format === 'json') {
        const blob = new Blob([JSON.stringify(finalData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `drug_matcher_export_${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'txt') {
        if (finalData.length === 0) return;
        const headers = Object.keys(finalData[0]);
        let txtContent = headers.join("\t") + "\n";
        finalData.forEach(row => {
          txtContent += headers.map(h => String(row[h] ?? "")).join("\t") + "\n";
        });
        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `drug_matcher_export_${timestamp}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setExportComplete(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      resetAndClose();
    } catch (err) {
      console.error("Export compilation failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const resetAndClose = () => {
    setStage(1);
    setFormat("xlsx");
    setScope("all");
    setOffset(0);
    setLimit(results.length || 100);
    setSelectedColumns(columnOptions.map(o => o.key));
    setExportComplete(false);
    setIsExporting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={resetAndClose}
          className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
        />

        {/* Modal Window Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Export Matched Results
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                {stage === 1 ? "Step 1: Choose target file format" : "Step 2: Customize export scope & attributes"}
              </p>
            </div>
            <button
              onClick={resetAndClose}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Wizard Body - Scrollable */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {stage === 1 ? (
              /* STAGE 1: Format Selector */
              <div className="space-y-4">
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  Select how you want to download and open the matched sheet:
                </p>

                <div className="grid grid-cols-1 gap-3">
                  {/* Excel Card */}
                  <button
                    onClick={() => setFormat("xlsx")}
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                      format === "xlsx"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${format === "xlsx" ? "bg-primary/10" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                      <FileSpreadsheet className="w-6 h-6 text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">Excel Spreadsheet (.xlsx)</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Ideal for analysis in Excel or Google Sheets. Fully flattens categories and brand slugs.
                      </p>
                    </div>
                  </button>

                  {/* JSON Card */}
                  <button
                    onClick={() => setFormat("json")}
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                      format === "json"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${format === "json" ? "bg-primary/10" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                      <FileJson className="w-6 h-6 text-warning" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">JSON Data Feed (.json)</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Raw nested structures. Optimized for developers, database loading, or automated integrations.
                      </p>
                    </div>
                  </button>

                  {/* Tab Delimited Plain Text */}
                  <button
                    onClick={() => setFormat("txt")}
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                      format === "txt"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${format === "txt" ? "bg-primary/10" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                      <FileText className="w-6 h-6 text-zinc-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">Tab-Separated Values (.txt)</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Clean flat text rows. Minimal file footprint, perfect for importing into lightweight databases.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* STAGE 2: Scope & Range Selection */
              <div className="space-y-6">
                {/* Scope Radio Selection */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Define Data Scope
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* All Option */}
                    <button
                      onClick={() => setScope("all")}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        scope === "all"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      <p className="text-xs font-bold">Entire Sheet</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">All {results.length} items</p>
                    </button>

                    {/* Slice Option */}
                    <button
                      onClick={() => setScope("slice")}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        scope === "slice"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      <p className="text-xs font-bold">Custom Range</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">Slice offset/limit</p>
                    </button>
                  </div>
                </div>

                {/* Slicing Controls (Shows only when 'slice' selected) */}
                {scope === "slice" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-4 bg-zinc-50 dark:bg-black/30 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 grid grid-cols-2 gap-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Start Index (Offset)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={results.length - 1}
                        value={offset}
                        onChange={(e) => setOffset(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Row Volume (Limit)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={results.length}
                        value={limit}
                        onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Columns Selection Checklist */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Attributes Checklist
                    </h3>
                    <button
                      onClick={handleSelectAllColumns}
                      className="text-[10px] font-bold text-primary hover:underline uppercase"
                    >
                      {selectedColumns.length === columnOptions.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-black/20 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
                    {columnOptions.map(col => {
                      const isChecked = selectedColumns.includes(col.key);
                      return (
                        <button
                          key={col.key}
                          onClick={() => handleToggleColumn(col.key)}
                          className="flex items-center gap-2 text-left hover:opacity-85 text-xs py-1"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            isChecked
                              ? "bg-primary border-primary text-white"
                              : "border-zinc-300 dark:border-zinc-700"
                          }`}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">
                            {col.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar Footer */}
          <div className="p-6 bg-zinc-50 dark:bg-black/20 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            {stage === 2 ? (
              <button
                disabled={isExporting}
                onClick={() => setStage(1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {stage === 1 ? (
              <button
                disabled={!format}
                onClick={() => setStage(2)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
              >
                Configure Scope
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                disabled={isExporting || selectedColumns.length === 0}
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-success disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-success/20 hover:bg-success-dark transition-all"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Compiling Stream...
                  </>
                ) : exportComplete ? (
                  <>
                    <Check className="w-4 h-4" />
                    Download Triggered!
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Generate & Download
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
