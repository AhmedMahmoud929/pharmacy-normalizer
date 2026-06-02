"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Download, FileSpreadsheet, FileJson, FileText, Check, Loader2, Folder, Image } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { API_URL } from "@/lib/utils";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  results: any[];
}

type Stage = 0 | 1 | 2;
type ExportFormat = "xlsx" | "json" | "txt";
type ExportScope = "all" | "slice";

interface ColumnOption {
  key: string;
  label: string;
  group: "matcher" | "product";
  defaultChecked?: boolean;
}

const columnOptions: ColumnOption[] = [
  // Matcher Fields
  { key: "row_index", label: "Row Number", group: "matcher", defaultChecked: false },
  { key: "original_name", label: "Original Product Name", group: "matcher", defaultChecked: false },
  { key: "normalized_name", label: "Normalized Query", group: "matcher", defaultChecked: false },
  { key: "match_status", label: "Match Status", group: "matcher", defaultChecked: true },
  { key: "match_score", label: "Confidence Score", group: "matcher", defaultChecked: true },
  { key: "jaccard", label: "Jaccard Token Overlap", group: "matcher", defaultChecked: false },
  { key: "sequence", label: "Sequence Similarity", group: "matcher", defaultChecked: false },
  { key: "matched_tokens", label: "Aligned Tokens", group: "matcher", defaultChecked: false },

  // Product Fields
  { key: "id", label: "Product ID", group: "product", defaultChecked: true },
  { key: "name_en", label: "English Name", group: "product", defaultChecked: true },
  { key: "name_ar", label: "Arabic Name", group: "product", defaultChecked: true },
  { key: "sku", label: "Reference SKU", group: "product", defaultChecked: true },
  { key: "brand", label: "Brand / Manufacturer", group: "product", defaultChecked: true },
  { key: "category", label: "Classification Category", group: "product", defaultChecked: true },
  { key: "price", label: "Catalog Price", group: "product", defaultChecked: true },
  { key: "in_stock", label: "In Stock Flag", group: "product", defaultChecked: true },
  { key: "stock", label: "Quantity Stock", group: "product", defaultChecked: true },
  { key: "share_link", label: "Storefront Web Link", group: "product", defaultChecked: true },
  { key: "image", label: "Asset Thumbnail URL", group: "product", defaultChecked: false },
  { key: "image_name", label: "Image Name", group: "product", defaultChecked: true }
];

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  results
}) => {
  const [stage, setStage] = useState<Stage>(0);
  const [exportType, setExportType] = useState<"data" | "media">("data");
  const [mediaTypes, setMediaTypes] = useState<string[]>(["products"]);
  const [format, setFormat] = useState<ExportFormat | null>("xlsx");
  const [scope, setScope] = useState<ExportScope>("all");

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
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columnOptions.filter(o => o.defaultChecked).map(o => o.key)
  );

  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  // Filter results dynamically based on chosen statuses
  const filteredResults = React.useMemo(() => {
    return results.filter(res => {
      const status = res.matches?.[0]?.status || "no_match";
      return selectedStatuses.includes(status);
    });
  }, [results, selectedStatuses]);

  // Set default bounds when filtered results are loaded/changed
  useEffect(() => {
    if (filteredResults && filteredResults.length > 0) {
      setLimit(filteredResults.length);
      setOffset(0);
    } else {
      setLimit(0);
      setOffset(0);
    }
  }, [filteredResults]);

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
    if (!format || filteredResults.length === 0 || selectedColumns.length === 0) return;
    setIsExporting(true);
    setExportComplete(false);

    try {
      // Artificially delay slightly to mimic compiling stream UX
      await new Promise(resolve => setTimeout(resolve, 800));

      // Resolve Range Slicing using status-filtered results
      let itemsToExport = [...filteredResults].sort((a, b) => a.row_index - b.row_index);
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
              record["row_number"] = res.row_index + 1;
              break;
            case "original_name":
              record["original_name"] = res.original_name;
              break;
            case "normalized_name":
              record["normalized_name"] = res.normalized_name;
              break;
            case "match_status":
              record["match_status"] = topMatch?.status || "no_match";
              break;
            case "match_score":
              record["match_score"] = topMatch ? (topMatch.score * 100).toFixed(1) + "%" : "0%";
              break;
            case "jaccard":
              record["jaccard_score"] = topMatch?.jaccard != null ? (topMatch.jaccard * 100).toFixed(1) + "%" : "";
              break;
            case "sequence":
              record["sequence_score"] = topMatch?.sequence != null ? (topMatch.sequence * 100).toFixed(1) + "%" : "";
              break;
            case "matched_tokens":
              record["matched_tokens"] = Array.isArray(topMatch?.matched_tokens) ? topMatch.matched_tokens.join(", ") : "";
              break;
            case "id":
              record["product_id"] = v.id || p.id || topMatch?.id || "";
              break;
            case "name_en":
              record["english_name"] = topMatch?.name_en || v.name_en || p.name_en || "";
              break;
            case "name_ar":
              record["arabic_name"] = v.name_ar || p.name_ar || "";
              break;
            case "sku":
              record["reference_sku"] = topMatch?.sku || v.sku || "";
              break;
            case "brand":
              record["brand"] = p.brand?.name || p.brand || "";
              break;
            case "category":
              record["category"] = p.category?.name || p.category || "";
              break;
            case "price":
              record["price"] = v.price || p.price || 0;
              break;
            case "in_stock":
              const hasStock = v.stock > 0 || p.stock > 0 || (p.in_stock !== false);
              record["in_stock"] = hasStock ? "Yes" : "No";
              break;
            case "stock":
              record["stock"] = v.stock || p.stock || 0;
              break;
            case "share_link":
              const slug = p.slug || "";
              record["share_link"] = slug ? `https://chefaa.com/product/${slug}` : "";
              break;
            case "image":
              record["image"] = v.image || p.image || topMatch?.image || "";
              break;
            case "image_name":
              record["image_name"] = p.image_name || p.local_image_name || topMatch?.local_image_name || "";
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

  const handleMediaExport = async () => {
    setIsExporting(true);
    setExportComplete(false);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      let itemsToExport = [...filteredResults].sort((a, b) => a.row_index - b.row_index);
      if (scope === "slice") {
        itemsToExport = itemsToExport.slice(offset, offset + limit);
      }

      const imageNames: string[] = [];
      itemsToExport.forEach(res => {
        const topMatch = res.matches?.[0];
        const p = topMatch?.product_data || {};
        const imgName = p.image_name || p.local_image_name || topMatch?.local_image_name;
        if (imgName) {
          imageNames.push(imgName);
        }
      });

      const response = await fetch(`${API_URL}/db/export/media`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          media_types: mediaTypes,
          image_names: imageNames
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
      a.download = `drug_matcher_media_export_${timestamp}.zip`;
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
    setMediaTypes(["products"]);
    setFormat("xlsx");
    setScope("all");
    setOffset(0);
    setLimit(results.length || 100);
    setSelectedStatuses(["matched", "review", "no_match"]);
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
                      <p className="font-bold text-sm">Product Match Sheets (Spreadsheet)</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Download structured product details, alignment scores, categories, and references in Excel, JSON, or TSV formats.
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

                {/* Scope & Match Status Filters */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Filter Media by Match Status
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "matched", label: "Matched", count: results.filter(r => (r.matches?.[0]?.status || "no_match") === "matched").length, selectedClass: "bg-success/10 text-success border-success/30 font-bold", unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500" },
                      { key: "review", label: "Review", count: results.filter(r => (r.matches?.[0]?.status || "no_match") === "review").length, selectedClass: "bg-warning/10 text-warning border-warning/30 font-bold", unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500" },
                      { key: "no_match", label: "No Match", count: results.filter(r => (r.matches?.[0]?.status || "no_match") === "no_match").length, selectedClass: "bg-error/10 text-error border-error/30 font-bold", unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500" }
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
                          className={`p-3 rounded-xl border text-center transition-all ${
                            isSelected ? statusOpt.selectedClass : statusOpt.unselectedClass
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
                      disabled={filteredResults.length === 0}
                      onClick={() => setScope("all")}
                      className={`p-3 rounded-xl border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        scope === "all"
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      <p className="text-xs font-bold">Entire Match List</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">All {filteredResults.length} matches</p>
                    </button>

                    <button
                      disabled={filteredResults.length === 0}
                      onClick={() => setScope("slice")}
                      className={`p-3 rounded-xl border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
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

                {scope === "slice" && filteredResults.length > 0 && (
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
                        max={Math.max(0, filteredResults.length - 1)}
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
                        max={filteredResults.length}
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
                        count: results.filter(r => (r.matches?.[0]?.status || "no_match") === "matched").length,
                        selectedClass: "bg-success/10 text-success border-success/30 font-bold",
                        unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500"
                      },
                      {
                        key: "review",
                        label: "Review",
                        count: results.filter(r => (r.matches?.[0]?.status || "no_match") === "review").length,
                        selectedClass: "bg-warning/10 text-warning border-warning/30 font-bold",
                        unselectedClass: "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500"
                      },
                      {
                        key: "no_match",
                        label: "No Match",
                        count: results.filter(r => (r.matches?.[0]?.status || "no_match") === "no_match").length,
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
                      disabled={filteredResults.length === 0}
                      onClick={() => setScope("all")}
                      className={`p-3 rounded-xl border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${scope === "all"
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-400"
                        }`}
                    >
                      <p className="text-xs font-bold">Entire Sheet</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">All {filteredResults.length} items</p>
                    </button>

                    {/* Slice Option */}
                    <button
                      disabled={filteredResults.length === 0}
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
                {scope === "slice" && filteredResults.length > 0 && (
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
                        max={Math.max(0, filteredResults.length - 1)}
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
                        max={filteredResults.length}
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
                disabled={isExporting || mediaTypes.length === 0 || filteredResults.length === 0}
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
                disabled={isExporting || selectedColumns.length === 0 || filteredResults.length === 0}
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
