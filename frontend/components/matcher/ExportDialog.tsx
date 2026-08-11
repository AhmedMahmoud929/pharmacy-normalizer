"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Download, FileSpreadsheet, FileJson, FileText, Check, Loader2, Folder, Image } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/lib/utils";
import { MatcherColumnOption as ColumnOption, matcherColumnOptions as staticColumnOptions, buildOriginalColumnOptions } from "@/constants/columns";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  jobStats?: {
    matched: number;
    review: number;
    noMatch: number;
    total: number;
  };
}

type Stage = 0 | 1 | 2;
type ExportFormat = "xlsx" | "json" | "txt";
type ExportScope = "all" | "slice";

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  jobId,
  jobStats
}) => {
  const [stage, setStage] = useState<Stage>(0);
  const [exportType, setExportType] = useState<"data" | "media">("data");
  const [mediaTypes, setMediaTypes] = useState<string[]>(["products"]);
  const [format, setFormat] = useState<ExportFormat | null>("xlsx");
  const [scope, setScope] = useState<ExportScope>("all");

  const [stats, setStats] = useState<{ matched: number; review: number; noMatch: number; total: number } | null>(null);
  const [originalColumnNames, setOriginalColumnNames] = useState<string[]>([]);

  const columnOptions = React.useMemo(() => {
    return [...buildOriginalColumnOptions(originalColumnNames), ...staticColumnOptions];
  }, [originalColumnNames]);

  const defaultSelectedColumns = React.useMemo(
    () => columnOptions.filter(o => o.defaultChecked).map(o => o.key),
    [columnOptions]
  );

  // Sync stats from parent when counts change (stable primitive deps — not object identity)
  useEffect(() => {
    if (!isOpen || !jobStats) return;
    setStats(prev => {
      if (
        prev &&
        prev.matched === jobStats.matched &&
        prev.review === jobStats.review &&
        prev.noMatch === jobStats.noMatch &&
        prev.total === jobStats.total
      ) {
        return prev;
      }
      return jobStats;
    });
  }, [isOpen, jobStats?.matched, jobStats?.review, jobStats?.noMatch, jobStats?.total]);

  // Fetch job metadata once when the dialog opens (original sheet columns)
  useEffect(() => {
    if (!isOpen || !jobId) return;

    let cancelled = false;

    fetch(`${API_URL}/api/matcher/job/${jobId}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (!jobStats) {
          setStats({
            matched: data.matched_count || 0,
            review: data.review_count || 0,
            noMatch: data.no_match_count || 0,
            total: data.total_rows || 0
          });
        }
        const nextColumns = Array.isArray(data.original_columns) ? data.original_columns : [];
        setOriginalColumnNames(prev => {
          if (prev.length === nextColumns.length && prev.every((col, i) => col === nextColumns[i])) {
            return prev;
          }
          return nextColumns;
        });
      })
      .catch(err => {
        if (!cancelled) {
          console.error("Failed to fetch job details in ExportDialog:", err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, jobId]);

  // Match Status Filtering State
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    "matched",
    "review",
    "no_match"
  ]);

  // Slicing Range State
  const [offset, setOffset] = useState<number>(0);
  const [limit, setLimit] = useState<number>(100);

  // Selected Columns Checklist
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const columnsTouchedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      columnsTouchedRef.current = false;
      return;
    }
    if (!columnsTouchedRef.current && defaultSelectedColumns.length > 0) {
      setSelectedColumns(defaultSelectedColumns);
    }
  }, [isOpen, defaultSelectedColumns]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportStatusText, setExportStatusText] = useState("");

  const counts = React.useMemo(() => {
    return {
      matched: stats?.matched ?? 0,
      review: stats?.review ?? 0,
      noMatch: stats?.noMatch ?? 0,
      total: stats?.total ?? 0
    };
  }, [stats]);

  // Calculate total filtered items based on checkboxes
  const totalFilteredCount = React.useMemo(() => {
    let sum = 0;
    if (selectedStatuses.includes("matched")) sum += counts.matched;
    if (selectedStatuses.includes("review")) sum += counts.review;
    if (selectedStatuses.includes("no_match")) sum += counts.noMatch;
    return sum;
  }, [selectedStatuses, counts]);

  // Set default bounds when totalFilteredCount changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      setLimit(totalFilteredCount);
      setOffset(0);
    }
  }, [totalFilteredCount, isOpen]);

  if (!isOpen) return null;

  const handleToggleColumn = (key: string) => {
    columnsTouchedRef.current = true;
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const handleSelectAllColumns = () => {
    columnsTouchedRef.current = true;
    if (selectedColumns.length === columnOptions.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(columnOptions.map(o => o.key));
    }
  };

  const handleExport = async () => {
    if (!format || !jobId || selectedColumns.length === 0) return;
    setIsExporting(true);
    setExportComplete(false);
    setExportStatusText("Preparing export data on backend...");

    try {
      const params = new URLSearchParams({
        format,
        statuses: selectedStatuses.join(","),
        scope,
        offset: offset.toString(),
        limit: limit.toString(),
        columns: selectedColumns.join(","),
      });

      setExportStatusText("Downloading export file...");
      const response = await fetch(`${API_URL}/api/matcher/job/${jobId}/export?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to export on server");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `drug_matcher_export_${timestamp}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatusText("Download ready!");
      setExportComplete(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      resetAndClose();
    } catch (err) {
      console.error("Export compilation failed:", err);
      setExportStatusText("Export compilation failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleMediaExport = async () => {
    if (!jobId) return;
    setIsExporting(true);
    setExportComplete(false);
    setExportStatusText("Preparing media export on backend...");

    try {
      const params = new URLSearchParams({
        statuses: selectedStatuses.join(","),
        scope,
        offset: offset.toString(),
        limit: limit.toString(),
        media_types: mediaTypes.join(","),
      });

      setExportStatusText("Downloading ZIP archive...");
      const response = await fetch(`${API_URL}/api/matcher/job/${jobId}/export_media?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to compile media zip");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `drug_matcher_media_export_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatusText("Download ready!");
      setExportComplete(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      resetAndClose();
    } catch (err) {
      console.error("Media export failed:", err);
      setExportStatusText("Media export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const resetAndClose = () => {
    setStage(0);
    setExportType("data");
    setMediaTypes(["products"]);
    setFormat("xlsx");
    setScope("all");
    setOffset(0);
    setLimit(100);
    setSelectedStatuses(["matched", "review", "no_match"]);
    setSelectedColumns(defaultSelectedColumns);
    setExportComplete(false);
    setIsExporting(false);
    setExportStatusText("");
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={resetAndClose}
          className="absolute inset-0 bg-black/40 dark:bg-zinc-950/60 backdrop-blur-md"
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
            {stage === 0 ? (
              /* STAGE 0: Export Type Selector */
              <div className="space-y-4">
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  Select what you want to export:
                </p>

                <div className="grid grid-cols-1 gap-3">
                  {/* Data Card */}
                  <button
                    onClick={() => setExportType("data")}
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${exportType === "data"
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                      }`}
                  >
                    <div className={`p-3 rounded-xl ${exportType === "data" ? "bg-primary/10" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                      <FileSpreadsheet className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">Product Match Sheets (Spreadsheet)</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Download structured product details, alignment scores, categories, and references in Excel, JSON, or TSV formats.
                      </p>
                    </div>
                  </button>

                  {/* Media Card */}
                  <button
                    onClick={() => setExportType("media")}
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${exportType === "media"
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                      }`}
                  >
                    <div className={`p-3 rounded-xl ${exportType === "media" ? "bg-primary/10" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                      <Image className="w-6 h-6 text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">Media Assets Directory (ZIP Archive)</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Compile and download a compressed ZIP package of locally stored brand logos or product images matching your current selection.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : exportType === "media" ? (
              /* MEDIA ASSETS CONFIGURATION SCREEN */
              <div className="space-y-6">
                {/* Media Types Checklist */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Select Media Types to Include
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "products", label: "Products Media", desc: "Local product image assets" },
                      { key: "brands", label: "Brands Media", desc: "Local manufacturer/brand logos" }
                    ].map(typeOpt => {
                      const isSelected = mediaTypes.includes(typeOpt.key);
                      return (
                        <button
                          key={typeOpt.key}
                          onClick={() => {
                            setMediaTypes(prev =>
                              prev.includes(typeOpt.key)
                                ? prev.filter(t => t !== typeOpt.key)
                                : [...prev, typeOpt.key]
                            );
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all ${isSelected
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-sm">{typeOpt.label}</p>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? "bg-primary border-primary text-primary-foreground" : "border-zinc-300 dark:border-zinc-700"
                              }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1">{typeOpt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                  {mediaTypes.length === 0 && (
                    <p className="text-[10px] text-error font-medium">Please select at least one media type to export.</p>
                  )}
                </div>

                {/* Scope & Match Status Filters */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Filter Media by Match Status
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "matched", label: "Matched", count: counts.matched, selectedClass: "bg-success/10 text-success border-success/30 font-bold", unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500" },
                      { key: "review", label: "Review", count: counts.review, selectedClass: "bg-warning/10 text-warning border-warning/30 font-bold", unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500" },
                      { key: "no_match", label: "No Match", count: counts.noMatch, selectedClass: "bg-error/10 text-error border-error/30 font-bold", unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500" }
                    ].map(statusOpt => {
                      const isSelected = selectedStatuses.includes(statusOpt.key);
                      return (
                        <button
                          key={statusOpt.key}
                          onClick={() => {
                            setSelectedStatuses(prev =>
                              prev.includes(statusOpt.key)
                                ? prev.filter(s => s !== statusOpt.key)
                                : [...prev, statusOpt.key]
                            );
                          }}
                          className={`p-3 rounded-xl border text-center transition-all ${isSelected ? statusOpt.selectedClass : statusOpt.unselectedClass
                            }`}
                        >
                          <p className="text-xs font-bold uppercase tracking-wider">{statusOpt.label}</p>
                          <p className={`text-[9px] mt-0.5 ${isSelected ? "opacity-90 font-semibold" : "opacity-60"}`}>
                            {statusOpt.count} items
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Slicing range configuration */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Define Range Scope
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={totalFilteredCount === 0}
                      onClick={() => setScope("all")}
                      className={`p-3 rounded-xl border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${scope === "all"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                        }`}
                    >
                      <p className="text-xs font-bold">Entire Match List</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">All {totalFilteredCount} matches</p>
                    </button>

                    <button
                      disabled={totalFilteredCount === 0}
                      onClick={() => setScope("slice")}
                      className={`p-3 rounded-xl border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${scope === "slice"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                        }`}
                    >
                      <p className="text-xs font-bold">Custom Range</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">Slice offset/limit</p>
                    </button>
                  </div>
                </div>

                {scope === "slice" && totalFilteredCount > 0 && (
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
                        max={Math.max(0, totalFilteredCount - 1)}
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
                        max={totalFilteredCount}
                        value={limit}
                        onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            ) : stage === 1 ? (
              /* STAGE 1: Format Selector */
              <div className="space-y-4">
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  Select how you want to download and open the matched sheet:
                </p>

                <div className="grid grid-cols-1 gap-3">
                  {/* Excel Card */}
                  <button
                    onClick={() => setFormat("xlsx")}
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${format === "xlsx"
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
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${format === "json"
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
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${format === "txt"
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
                {/* Filter by Match Status */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Filter by Match Status
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        key: "matched",
                        label: "Matched",
                        count: counts.matched,
                        selectedClass: "bg-success/10 text-success border-success/30 font-bold",
                        unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500"
                      },
                      {
                        key: "review",
                        label: "Review",
                        count: counts.review,
                        selectedClass: "bg-warning/10 text-warning border-warning/30 font-bold",
                        unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500"
                      },
                      {
                        key: "no_match",
                        label: "No Match",
                        count: counts.noMatch,
                        selectedClass: "bg-error/10 text-error border-error/30 font-bold",
                        unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500"
                      },
                    ].map(statusOpt => {
                      const isSelected = selectedStatuses.includes(statusOpt.key);
                      return (
                        <button
                          key={statusOpt.key}
                          onClick={() => {
                            setSelectedStatuses(prev =>
                              prev.includes(statusOpt.key)
                                ? prev.filter(s => s !== statusOpt.key)
                                : [...prev, statusOpt.key]
                            );
                          }}
                          className={`p-3 rounded-xl border text-center transition-all ${isSelected ? statusOpt.selectedClass : statusOpt.unselectedClass
                            }`}
                        >
                          <p className="text-xs font-bold uppercase tracking-wider">{statusOpt.label}</p>
                          <p className={`text-[9px] mt-0.5 ${isSelected ? "opacity-90 font-semibold" : "opacity-60"}`}>
                            {statusOpt.count} items
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {selectedStatuses.length === 0 && (
                    <p className="text-[10px] text-error font-medium">Please select at least one status to export.</p>
                  )}
                </div>

                {/* Define Scope */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Define Data Scope
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* All Option */}
                    <button
                      disabled={totalFilteredCount === 0}
                      onClick={() => setScope("all")}
                      className={`p-3 rounded-xl border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${scope === "all"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                        }`}
                    >
                      <p className="text-xs font-bold">Entire Sheet</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">All {totalFilteredCount} items</p>
                    </button>

                    {/* Slice Option */}
                    <button
                      disabled={totalFilteredCount === 0}
                      onClick={() => setScope("slice")}
                      className={`p-3 rounded-xl border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${scope === "slice"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                        }`}
                    >
                      <p className="text-xs font-bold">Custom Range</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">Slice offset/limit</p>
                    </button>
                  </div>
                </div>

                {/* Slicing Controls (Only when slice is active and we have items) */}
                {scope === "slice" && totalFilteredCount > 0 && (
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
                        max={Math.max(0, totalFilteredCount - 1)}
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
                        max={totalFilteredCount}
                        value={limit}
                        onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Attributes Checklist */}
                <div className="space-y-4">
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

                  <div className="space-y-4 overflow-y-auto pr-1">
                    {/* Original Sheet Columns Group */}
                    {columnOptions.some(col => col.group === "original") && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500/90 bg-emerald-500/10 px-2 py-0.5 rounded w-fit">
                          Original Sheet Columns
                        </p>
                        <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-black/20 p-3 rounded-2xl border border-emerald-200/40 dark:border-emerald-800/30">
                          {columnOptions.filter(col => col.group === "original").map(col => {
                            const isChecked = selectedColumns.includes(col.key);
                            return (
                              <button
                                key={col.key}
                                onClick={() => handleToggleColumn(col.key)}
                                className="flex items-center gap-2 text-left hover:opacity-85 text-xs py-1"
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked
                                  ? "bg-emerald-500 border-emerald-500 text-white"
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
                    )}

                    {/* Custom Export Fields Group */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-400/90 bg-violet-500/10 px-2 py-0.5 rounded w-fit">
                        Custom Export Fields
                      </p>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-black/20 p-3 rounded-2xl border border-violet-200/40 dark:border-violet-800/30">
                        {columnOptions.filter(col => col.group === "custom").map(col => {
                          const isChecked = selectedColumns.includes(col.key);
                          return (
                            <button
                              key={col.key}
                              onClick={() => handleToggleColumn(col.key)}
                              className="flex items-center gap-2 text-left hover:opacity-85 text-xs py-1"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked
                                ? "bg-violet-500 border-violet-500 text-white"
                                : "border-zinc-300 dark:border-zinc-700"
                                }`}>
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate font-mono text-[10px]">
                                {col.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Product Fields Group */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400/90 bg-zinc-55 dark:bg-zinc-800/50 px-2 py-0.5 rounded w-fit">
                        Product Fields
                      </p>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-black/20 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
                        {columnOptions.filter(col => col.group === "product").map(col => {
                          const isChecked = selectedColumns.includes(col.key);
                          return (
                            <button
                              key={col.key}
                              onClick={() => handleToggleColumn(col.key)}
                              className="flex items-center gap-2 text-left hover:opacity-85 text-xs py-1"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked
                                ? "bg-primary border-primary text-primary-foreground"
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

                    {/* Matcher Fields Group */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400/90 bg-zinc-55 dark:bg-zinc-800/50 px-2 py-0.5 rounded w-fit">
                        Matcher Fields
                      </p>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-black/20 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
                        {columnOptions.filter(col => col.group === "matcher").map(col => {
                          const isChecked = selectedColumns.includes(col.key);
                          return (
                            <button
                              key={col.key}
                              onClick={() => handleToggleColumn(col.key)}
                              className="flex items-center gap-2 text-left hover:opacity-85 text-xs py-1"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked
                                ? "bg-primary border-primary text-primary-foreground"
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
                </div>
              </div>
            )}
          </div>

          {/* Action Bar Footer */}
          <div className="p-6 bg-zinc-50 dark:bg-black/20 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            {stage > 0 ? (
              <button
                disabled={isExporting}
                onClick={() => setStage(prev => (exportType === "media" ? 0 : (prev - 1) as Stage))}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {stage === 0 ? (
              <button
                onClick={() => setStage(1)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : exportType === "media" ? (
              <button
                disabled={isExporting || mediaTypes.length === 0 || totalFilteredCount === 0}
                onClick={handleMediaExport}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-success disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-success/20 hover:bg-success-dark transition-all"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Zipping Media...
                  </>
                ) : exportComplete ? (
                  <>
                    <Check className="w-4 h-4" />
                    ZIP Triggered!
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Generate & Download Media
                  </>
                )}
              </button>
            ) : stage === 1 ? (
              <button
                disabled={!format}
                onClick={() => setStage(2)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary disabled:opacity-50 text-primary-foreground text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
              >
                Configure Scope
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                disabled={isExporting || selectedColumns.length === 0 || totalFilteredCount === 0}
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
                    Generate & Download Data
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
