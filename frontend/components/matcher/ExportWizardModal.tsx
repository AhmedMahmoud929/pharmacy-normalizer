"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Download, FileSpreadsheet, FileJson, FileText, Check, Loader2, Image } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/lib/utils";
import { ColumnOption, brandColumnOptions, categoryColumnOptions, browseProductColumnOptions, MatcherColumnOption } from "@/constants/columns";

interface ExportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSearch: string;
  totalProducts: number;
  mode?: "products" | "brands" | "categories";
}

type Stage = 0 | 1 | 2;
type ExportFormat = "xlsx" | "json" | "txt";
type ExportScope = "all" | "filtered" | "slice";

export const ExportWizardModal: React.FC<ExportWizardModalProps> = ({
  isOpen,
  onClose,
  activeSearch,
  totalProducts,
  mode = "products"
}) => {
  const [stage, setStage] = useState<Stage>(0);
  const [exportType, setExportType] = useState<"data" | "media">("data");
  const [mediaTypes, setMediaTypes] = useState<string[]>(["products", "brands"]);
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [scope, setScope] = useState<ExportScope>("all");

  // Slicing Range State
  const [offset, setOffset] = useState<number>(0);
  const [limit, setLimit] = useState<number>(1000);

  // Selected Columns Checklist
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // Selected Levels Checklist (only for categories export)
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setExportComplete(false);
      setIsExporting(false);
      setFormat(null);
      setScope("all");
      setOffset(0);
      setLimit(1000);

      if (mode === "categories") {
        setStage(1); // Categories skip Stage 0
        setExportType("data");
        setSelectedColumns(categoryColumnOptions.filter(o => o.defaultChecked !== false).map(o => o.key));
        setSelectedLevels([1, 2, 3]);
      } else if (mode === "brands") {
        setStage(0);
        setExportType("data");
        setMediaTypes(["brands"]);
        setSelectedColumns(brandColumnOptions.filter(o => o.defaultChecked !== false).map(o => o.key));
      } else {
        setStage(0);
        setExportType("data");
        setMediaTypes(["products", "brands"]);
        setSelectedColumns(browseProductColumnOptions.filter(o => o.defaultChecked !== false).map(o => o.key));
      }
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const currentColumnOptions: (ColumnOption | MatcherColumnOption)[] =
    mode === "brands" ? brandColumnOptions :
      mode === "categories" ? categoryColumnOptions :
        browseProductColumnOptions;

  const handleToggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const handleSelectAllColumns = () => {
    if (selectedColumns.length === currentColumnOptions.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(currentColumnOptions.map(o => o.key));
    }
  };

  const handleToggleLevel = (lvl: number) => {
    setSelectedLevels(prev =>
      prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl]
    );
  };

  const handleExport = async () => {
    if (!format) return;
    setIsExporting(true);
    setExportComplete(false);

    try {
      const colParam = selectedColumns.join(",");
      let url = "";

      if (mode === "products") {
        url = `${API_URL}/db/export?format=${format}&scope=${scope}&columns=${colParam}`;
        if (scope === "filtered" && activeSearch) {
          url += `&search=${encodeURIComponent(activeSearch)}`;
        } else if (scope === "slice") {
          url += `&offset=${offset}&limit=${limit}`;
        }
      } else if (mode === "brands") {
        url = `${API_URL}/db/export/brands?format=${format}&scope=${scope}&columns=${colParam}`;
        if (scope === "slice") {
          url += `&offset=${offset}&limit=${limit}`;
        }
      } else if (mode === "categories") {
        const lvlParam = selectedLevels.join(",");
        url = `${API_URL}/db/export/categories?format=${format}&scope=${scope}&columns=${colParam}&levels=${lvlParam}`;
        if (scope === "slice") {
          url += `&offset=${offset}&limit=${limit}`;
        }
      }

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `chefaa_${mode}_export.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await new Promise(resolve => setTimeout(resolve, 1500));
      setExportComplete(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      resetAndClose();
    } catch (err) {
      console.error("Export compilation failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleMediaExport = async () => {
    setIsExporting(true);
    setExportComplete(false);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const response = await fetch(`${API_URL}/db/export/media`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          media_types: mediaTypes,
          image_names: null
        })
      });

      if (!response.ok) {
        throw new Error("Failed to compile media zip");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `chefaa_${mode}_media_export_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportComplete(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      resetAndClose();
    } catch (err) {
      console.error("Media export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const resetAndClose = () => {
    setStage(0);
    setExportType("data");
    setMediaTypes(["products", "brands"]);
    setFormat(null);
    setScope("all");
    setOffset(0);
    setLimit(1000);
    setSelectedColumns([]);
    setSelectedLevels([1, 2, 3]);
    setExportComplete(false);
    setIsExporting(false);
    onClose();
  };

  const getModalTitle = () => {
    if (mode === "brands") return "Export Brands Catalog";
    if (mode === "categories") return "Export Categories Taxonomy";
    return "Export Catalog Data";
  };

  const getModalSubtitle = () => {
    if (stage === 0) {
      return mode === "brands"
        ? "Choose between exporting brand spreadsheet data or brand logo assets"
        : "Choose between exporting spreadsheet data or downloading local media assets";
    }
    if (exportType === "media") return "Customize media type scope";
    if (stage === 1) return "Step 1: Choose target file format";
    return "Step 2: Customize export scope & attributes";
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[95vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {getModalTitle()}
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                {getModalSubtitle()}
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
                      <p className="font-bold text-sm">
                        {mode === "brands" ? "Brands Catalog Sheets (Spreadsheet)" : "Product Catalog Sheets (Spreadsheet)"}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {mode === "brands"
                          ? "Download structured brand details, names, reference slugs, and logo URLs in Excel, JSON, or TXT."
                          : "Download structured catalog details, prices, stocks, and storefront links in Excel, JSON, or TSV formats."}
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
                        {mode === "brands"
                          ? "Compile and download a compressed ZIP package of ALL locally stored brand logos from the storage."
                          : "Compile and download a compressed ZIP package of ALL locally stored brand logos and product images from the storage."}
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : exportType === "media" ? (
              /* MEDIA ASSETS CONFIGURATION SCREEN */
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Select Media Types to Include
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "products", label: "Products Media", desc: "All product image assets", hidden: mode === "brands" },
                      { key: "brands", label: "Brands Media", desc: "All manufacturer/brand logos", hidden: false }
                    ].filter(x => !x.hidden).map(typeOpt => {
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
              </div>
            ) : stage === 1 ? (
              /* STAGE 1: Format Selector */
              <div className="space-y-4">
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  Select how you want to download and open the spreadsheet feed:
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
                        Ideal for analysis in Excel or Google Sheets. Fully flattens reference data attributes.
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
                        Raw data feeds. Optimized for developers, database loading, or automated integrations.
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
                {/* Scope Radio Selection */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Define Data Scope
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* All Option */}
                    <button
                      onClick={() => setScope("all")}
                      className={`p-3 rounded-xl border text-center transition-all ${scope === "all"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                        }`}
                    >
                      <p className="text-xs font-bold">Entire Dataset</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">
                        {mode === "products"
                          ? totalProducts > 0
                            ? `All ${totalProducts.toLocaleString()} items`
                            : "All catalog items"
                          : totalProducts > 0
                            ? `All ${totalProducts.toLocaleString()} entries`
                            : "All reference entries"}
                      </p>
                    </button>

                    {/* Filtered Option (only available for products) */}
                    <button
                      disabled={!activeSearch || mode !== "products"}
                      onClick={() => setScope("filtered")}
                      className={`p-3 rounded-xl border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${scope === "filtered"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                        }`}
                    >
                      <p className="text-xs font-bold">Active Filters</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">
                        {activeSearch && mode === "products" ? `Query: "${activeSearch}"` : "Not Applicable"}
                      </p>
                    </button>

                    {/* Slice Option */}
                    <button
                      onClick={() => setScope("slice")}
                      className={`p-3 rounded-xl border text-center transition-all ${scope === "slice"
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
                        value={limit}
                        onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Categories Taxonomy Levels Checklist */}
                {mode === "categories" && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Include Taxonomy Levels
                    </h3>
                    <div className="grid grid-cols-3 gap-2 bg-zinc-50 dark:bg-black/20 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
                      {[1, 2, 3].map(lvl => {
                        const isChecked = selectedLevels.includes(lvl);
                        return (
                          <button
                            key={lvl}
                            onClick={() => handleToggleLevel(lvl)}
                            className="flex items-center gap-2 text-left hover:opacity-85 text-xs py-1"
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-zinc-300 dark:border-zinc-700"
                              }`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="text-zinc-700 dark:text-zinc-300 font-bold">
                              Level {lvl}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
                      {selectedColumns.length === currentColumnOptions.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {mode === "products" ? (
                    <div className="space-y-4 overflow-y-auto pr-1 max-h-[320px]">
                      <div className="space-y-2">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-400/90 bg-violet-500/10 px-2 py-0.5 rounded w-fit">
                          Custom Export Fields
                        </p>
                        <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-black/20 p-3 rounded-2xl border border-violet-200/40 dark:border-violet-800/30">
                          {browseProductColumnOptions.filter(col => col.group === "custom").map(col => {
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

                      <div className="space-y-2">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400/90 bg-zinc-55 dark:bg-zinc-800/50 px-2 py-0.5 rounded w-fit">
                          Product Fields
                        </p>
                        <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-black/20 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
                          {browseProductColumnOptions.filter(col => col.group === "product").map(col => {
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
                  ) : (
                    <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-black/20 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
                      {currentColumnOptions.map(col => {
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
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Bar Footer */}
          <div className="p-6 bg-zinc-50 dark:bg-black/20 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            {stage > (mode === "categories" ? 1 : 0) ? (
              <button
                disabled={isExporting}
                onClick={() => setStage(prev => (exportType === "media" ? 0 : (prev - 1) as Stage))}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {stage === 0 ? (
              exportType === "media" && mode === "brands" ? (
                <button
                  disabled={isExporting}
                  onClick={handleMediaExport}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-success disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-success/20 hover:bg-success-dark transition-all cursor-pointer"
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
              ) : (
                <button
                  onClick={() => setStage(1)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all cursor-pointer"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              )
            ) : exportType === "media" ? (
              <button
                disabled={isExporting || mediaTypes.length === 0}
                onClick={handleMediaExport}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-success disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-success/20 hover:bg-success-dark transition-all cursor-pointer"
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
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary disabled:opacity-50 text-primary-foreground text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all cursor-pointer"
              >
                Configure Scope
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                disabled={isExporting || selectedColumns.length === 0 || (mode === "categories" && selectedLevels.length === 0)}
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-success disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-success/20 hover:bg-success-dark transition-all cursor-pointer"
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
