"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Download, FileSpreadsheet, FileJson, FileText, Check, Loader2, Folder, Image } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { API_URL } from "@/lib/utils";
import { MatcherColumnOption as ColumnOption, matcherColumnOptions as columnOptions } from "@/constants/columns";

const extractImageName = (val: any): string => {
  if (!val) return "";
  if (Array.isArray(val)) {
    return val.map(x => extractImageName(x)).filter(Boolean).join(", ");
  }
  if (typeof val === "string") {
    if (val.includes(",")) {
      return val.split(",").map(p => extractImageName(p.trim())).filter(Boolean).join(", ");
    }
    const cleanVal = val.split("?")[0];
    const parts = cleanVal.split(/[\/\\]/);
    return parts[parts.length - 1] || "";
  }
  return String(val);
};

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
  initialResults?: any[];
}

type Stage = 0 | 1 | 2;
type ExportFormat = "xlsx" | "json" | "txt";
type ExportScope = "all" | "slice";

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  jobId,
  jobStats,
  initialResults
}) => {
  const [stage, setStage] = useState<Stage>(0);
  const [exportType, setExportType] = useState<"data" | "media">("data");
  const [mediaTypes, setMediaTypes] = useState<string[]>(["products"]);
  const [format, setFormat] = useState<ExportFormat | null>("xlsx");
  const [scope, setScope] = useState<ExportScope>("all");

  const [fetchedResults, setFetchedResults] = useState<any[]>(initialResults || []);

  useEffect(() => {
    if (initialResults && initialResults.length > 0) {
      setFetchedResults(initialResults);
    } else {
      setFetchedResults([]);
    }
  }, [initialResults, isOpen]);

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
  const [exportStatusText, setExportStatusText] = useState("");

  // Calculate status counts either from loaded results or from jobStats prop
  const counts = React.useMemo(() => {
    if (fetchedResults && fetchedResults.length > 0) {
      const matched = fetchedResults.filter(r => (r.matches?.[0]?.status || "no_match") === "matched").length;
      const review = fetchedResults.filter(r => (r.matches?.[0]?.status || "no_match") === "review").length;
      const noMatch = fetchedResults.length - matched - review;
      return { matched, review, noMatch, total: fetchedResults.length };
    }
    return {
      matched: jobStats?.matched ?? 0,
      review: jobStats?.review ?? 0,
      noMatch: jobStats?.noMatch ?? 0,
      total: jobStats?.total ?? 0
    };
  }, [fetchedResults, jobStats]);

  // Calculate total filtered items based on checkboxes when we haven't fetched results yet
  const totalFilteredCount = React.useMemo(() => {
    let sum = 0;
    if (selectedStatuses.includes("matched")) sum += counts.matched;
    if (selectedStatuses.includes("review")) sum += counts.review;
    if (selectedStatuses.includes("no_match")) sum += counts.noMatch;
    return sum;
  }, [selectedStatuses, counts]);

  // Filter results dynamically based on chosen statuses (if we have results loaded)
  const filteredResults = React.useMemo(() => {
    return fetchedResults.filter(res => {
      const status = res.matches?.[0]?.status || "no_match";
      return selectedStatuses.includes(status);
    });
  }, [fetchedResults, selectedStatuses]);

  // Set default bounds when filtered results are loaded/changed or filters change
  useEffect(() => {
    if (filteredResults && filteredResults.length > 0) {
      setLimit(filteredResults.length);
      setOffset(0);
    } else {
      setLimit(totalFilteredCount);
      setOffset(0);
    }
  }, [filteredResults, totalFilteredCount, isOpen]);

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
    if (!format || !jobId || selectedColumns.length === 0) return;
    setIsExporting(true);
    setExportComplete(false);
    setExportStatusText("Preparing export data...");

    try {
      let currentResults = fetchedResults;

      // If we haven't fetched results yet, fetch them now at the last step!
      if (currentResults.length === 0) {
        setExportStatusText("Downloading campaign results...");
        const response = await fetch(`${API_URL}/api/matcher/job/${jobId}/results?limit=100000`);
        if (!response.ok) throw new Error("Failed to fetch results from server");
        const data = await response.json();
        currentResults = data.results || [];
        setFetchedResults(currentResults);
      }

      if (currentResults.length === 0) {
        throw new Error("No results found to export");
      }

      setExportStatusText("Compiling custom dataset...");
      await new Promise(resolve => setTimeout(resolve, 300));

      // Resolve Range Slicing using status-filtered results
      const activeFiltered = currentResults.filter(res => {
        const status = res.matches?.[0]?.status || "no_match";
        return selectedStatuses.includes(status);
      });

      let itemsToExport = [...activeFiltered].sort((a, b) => a.row_index - b.row_index);
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

            // ── Custom Export Fields (spec: matcher-custom-export.md) ──────────
            case "custom_name_en":
              record["name[en]"] = topMatch?.name_en || p["name_en"] || p["title_en"] || "";
              break;
            case "custom_name_ar":
              record["name[ar]"] = p["name_ar"] || p["title_ar"] || "";
              break;
            case "custom_details_en":
              record["details[en]"] = p["description_en"] || p["meta_description_en"] || "";
              break;
            case "custom_details_ar":
              record["details[ar]"] = p["description_ar"] || p["meta_description_ar"] || "";
              break;
            case "custom_price":
              record["price"] = v["price"] || p["price"] || p["final_price"] || 0;
              break;
            case "custom_unit":
              record["unit"] = p["unit"] || "";
              break;
            case "custom_thumbnail":
              record["thumbnail"] = extractImageName(p["image"] || v["image"] || topMatch?.image || "");
              break;
            case "custom_images":
              record["images"] = extractImageName(p["image"] || v["image"] || topMatch?.image || "");
              break;
            case "custom_brand_name_en": {
              const br2 = p["brands"] || p["brand"];
              record["brand_name[en]"] = (typeof br2 === "object" && br2 !== null) ? (br2["name_en"] || br2["title_en"] || "") : (br2 || "");
              break;
            }
            case "custom_brand_name_ar": {
              const br3 = p["brands"] || p["brand"];
              record["brand_name[ar]"] = (typeof br3 === "object" && br3 !== null) ? (br3["name_ar"] || br3["title_ar"] || "") : "";
              break;
            }
            case "custom_brand_slug": {
              const br4 = p["brands"] || p["brand"];
              record["brand_slug"] = (typeof br4 === "object" && br4 !== null) ? (br4["slug"] || "") : "";
              break;
            }
            case "custom_brand_logo": {
              const br5 = p["brands"] || p["brand"];
              record["brand_logo"] = extractImageName((typeof br5 === "object" && br5 !== null) ? (br5["images"] || br5["logo_url"] || br5["image"] || "") : "");
              break;
            }
            case "custom_category_name_en": {
              const cat1 = p["category"] || p["level_one_category"];
              record["category_name[en]"] = (typeof cat1 === "object" && cat1 !== null) ? (cat1["name_en"] || cat1["name"] || cat1["title_en"] || "") : (cat1 || "");
              break;
            }
            case "custom_category_name_ar": {
              const cat1a = p["category"] || p["level_one_category"];
              record["category_name[ar]"] = (typeof cat1a === "object" && cat1a !== null) ? (cat1a["name_ar"] || cat1a["title_ar"] || "") : "";
              break;
            }
            case "custom_category_slug": {
              const cat1s = p["category"] || p["level_one_category"];
              record["category_slug"] = (typeof cat1s === "object" && cat1s !== null) ? (cat1s["slug"] || "") : (cat1s || "");
              break;
            }
            case "custom_sub_category_name_en": {
              const l2n = Array.isArray(p["level_two_category"]) ? (p["level_two_category"][0] ?? {}) : (p["level_two_category"] || {});
              record["sub_category_name[en]"] = l2n?.["name_en"] || l2n?.["title_en"] || "";
              break;
            }
            case "custom_sub_category_name_ar": {
              const l2na = Array.isArray(p["level_two_category"]) ? (p["level_two_category"][0] ?? {}) : (p["level_two_category"] || {});
              record["sub_category_name[ar]"] = l2na?.["name_ar"] || l2na?.["title_ar"] || "";
              break;
            }
            case "custom_sub_category_slug": {
              const l2s = Array.isArray(p["level_two_category"]) ? (p["level_two_category"][0] ?? {}) : (p["level_two_category"] || {});
              record["sub_category_slug"] = l2s?.["slug"] || "";
              break;
            }
            case "custom_sub_sub_category_name_en": {
              const l3n = Array.isArray(p["level_three_category"]) ? (p["level_three_category"][0] ?? {}) : (p["level_three_category"] || {});
              record["sub_sub_category_name[en]"] = l3n?.["name_en"] || l3n?.["title_en"] || "";
              break;
            }
            case "custom_sub_sub_category_name_ar": {
              const l3na = Array.isArray(p["level_three_category"]) ? (p["level_three_category"][0] ?? {}) : (p["level_three_category"] || {});
              record["sub_sub_category_name[ar]"] = l3na?.["name_ar"] || l3na?.["title_ar"] || "";
              break;
            }
            case "custom_sub_sub_category_slug": {
              const l3s = Array.isArray(p["level_three_category"]) ? (p["level_three_category"][0] ?? {}) : (p["level_three_category"] || {});
              record["sub_sub_category_slug"] = l3s?.["slug"] || "";
              break;
            }
            default:
              break;
          }
        });

        return record;
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      setExportStatusText("Generating export file...");
      await new Promise(resolve => setTimeout(resolve, 200));

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
    setExportStatusText("Preparing media export...");

    try {
      let currentResults = fetchedResults;

      // If we haven't fetched results yet, fetch them now at the last step!
      if (currentResults.length === 0) {
        setExportStatusText("Downloading campaign results...");
        const response = await fetch(`${API_URL}/api/matcher/job/${jobId}/results?limit=100000`);
        if (!response.ok) throw new Error("Failed to fetch results from server");
        const data = await response.json();
        currentResults = data.results || [];
        setFetchedResults(currentResults);
      }

      setExportStatusText("Compiling image references...");
      await new Promise(resolve => setTimeout(resolve, 300));

      const activeFiltered = currentResults.filter(res => {
        const status = res.matches?.[0]?.status || "no_match";
        return selectedStatuses.includes(status);
      });

      let itemsToExport = [...activeFiltered].sort((a, b) => a.row_index - b.row_index);
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

      setExportStatusText("Requesting ZIP archive...");
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

      setExportStatusText("Downloading ZIP archive...");
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
    setLimit(fetchedResults.length || jobStats?.total || 100);
    setSelectedStatuses(["matched", "review", "no_match"]);
    setSelectedColumns(columnOptions.filter(o => o.defaultChecked).map(o => o.key));
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
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? "bg-primary border-primary text-white" : "border-zinc-300 dark:border-zinc-700"
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
