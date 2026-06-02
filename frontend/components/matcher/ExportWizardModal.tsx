"use client";

import React, { useState } from "react";
import { X, ChevronRight, ChevronLeft, Download, FileSpreadsheet, FileJson, FileText, Check, Loader2, Folder, Image } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/lib/utils";

interface ExportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSearch: string;
  totalProducts: number;
}

type Stage = 0 | 1 | 2;
type ExportFormat = "xlsx" | "json" | "txt";
type ExportScope = "all" | "filtered" | "slice";

interface ColumnOption {
  key: string;
  label: string;
  defaultChecked?: boolean;
}

const columnOptions: ColumnOption[] = [
  { key: "id", label: "Product ID", defaultChecked: true },
  { key: "name_en", label: "English Name", defaultChecked: true },
  { key: "name_ar", label: "Arabic Name", defaultChecked: true },
  { key: "sku", label: "Reference SKU", defaultChecked: true },
  { key: "brand", label: "Brand / Manufacturer", defaultChecked: true },
  { key: "category", label: "Classification Category", defaultChecked: true },
  { key: "price", label: "Catalog Price", defaultChecked: true },
  { key: "in_stock", label: "In Stock Flag", defaultChecked: true },
  { key: "stock", label: "Quantity Stock", defaultChecked: true },
  { key: "share_link", label: "Storefront Web Link", defaultChecked: true },
  { key: "image", label: "Asset Thumbnail URL", defaultChecked: false },
  { key: "image_name", label: "Image Name", defaultChecked: true }
];

export const ExportWizardModal: React.FC<ExportWizardModalProps> = ({
  isOpen,
  onClose,
  activeSearch,
  totalProducts
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
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columnOptions.filter(o => o.defaultChecked !== false).map(o => o.key)
  );

  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

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
    if (!format) return;
    setIsExporting(true);
    setExportComplete(false);

    try {
      // Build Columns Params
      const colParam = selectedColumns.join(",");
      
      // Build API URL
      let url = `${API_URL}/db/export?format=${format}&scope=${scope}&columns=${colParam}`;
      
      if (scope === "filtered" && activeSearch) {
        url += `&search=${encodeURIComponent(activeSearch)}`;
      } else if (scope === "slice") {
        url += `&offset=${offset}&limit=${limit}`;
      }

      // Trigger browser download by creating a temporary anchor element
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `chefaa_products_export.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Artificially wait for the download stream initialization before completing
      await new Promise(resolve => setTimeout(resolve, 1500));
      setExportComplete(true);
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
      a.download = `chefaa_catalog_media_export_${timestamp}.zip`;
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
    setSelectedColumns(columnOptions.filter(o => o.defaultChecked !== false).map(o => o.key));
    setExportComplete(false);
    setIsExporting(false);
    onClose();
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
                Export Catalog Data
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                {stage === 0
                  ? "Choose between exporting spreadsheet data or downloading local media assets"
                  : exportType === "media"
                  ? "Customize media type scope"
                  : stage === 1
                  ? "Step 1: Choose target file format"
                  : "Step 2: Customize export scope & attributes"}
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
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                      exportType === "data"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${exportType === "data" ? "bg-primary/10" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                      <FileSpreadsheet className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">Product Catalog Sheets (Spreadsheet)</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Download structured catalog details, prices, stocks, and storefront links in Excel, JSON, or TSV formats.
                      </p>
                    </div>
                  </button>

                  {/* Media Card */}
                  <button
                    onClick={() => setExportType("media")}
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                      exportType === "media"
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
                        Compile and download a compressed ZIP package of ALL locally stored brand logos and product images from the storage.
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
                      { key: "products", label: "Products Media", desc: "All product image assets" },
                      { key: "brands", label: "Brands Media", desc: "All manufacturer/brand logos" }
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
                          className={`p-4 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 text-primary shadow-sm"
                              : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-sm">{typeOpt.label}</p>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              isSelected ? "bg-primary border-primary text-white" : "border-zinc-300 dark:border-zinc-700"
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
                  Select how you want to download and open the product catalog:
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* All Option */}
                    <button
                      onClick={() => setScope("all")}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        scope === "all"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      <p className="text-xs font-bold">Entire Catalog</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">All ~29k items</p>
                    </button>

                    {/* Filtered Option */}
                    <button
                      disabled={!activeSearch}
                      onClick={() => setScope("filtered")}
                      className={`p-3 rounded-xl border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        scope === "filtered"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      <p className="text-xs font-bold">Active Filters</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">
                        {activeSearch ? `Query: "${activeSearch}"` : "No Active Search"}
                      </p>
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
                        max={totalProducts}
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
                        max={totalProducts}
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
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : exportType === "media" ? (
              <button
                disabled={isExporting || mediaTypes.length === 0}
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
