"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CloudLightning,
  Loader2,
  AlertCircle,
  Search,
  RefreshCw,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  X,
  FileText,
  Layers,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCrawler } from "../crawler-context";

export default function ExplorerPage() {
  const router = useRouter();
  const {
    jobs,
    selectedJobIdForBrowse,
    setSelectedJobIdForBrowse,
    explorerProducts,
    expTotal,
    expPage,
    setExpPage,
    expSearch,
    setExpSearch,
    expCategory,
    setExpCategory,
    expBrand,
    setExpBrand,
    inspectItem,
    setInspectItem,
    activeLangTab,
    setActiveLangTab,
    carouselIdx,
    setCarouselIdx,
    expLoading,
    sanitizeHtml,
    triggerMediaFetch,
    setActiveJobId,
    connectToTelemetryStream,
    setShowParamsForm
  } = useCrawler();


  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6"
    >

      {/* Select Job dropdown and Filters using shadcn components */}
      <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl shadow-md grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1.5">Select Campaign</label>
          <Select
            value={selectedJobIdForBrowse || ""}
            onValueChange={(val) => {
              setSelectedJobIdForBrowse(val);
              setExpPage(1);
            }}
          >
            <SelectTrigger className="w-full bg-zinc-950/50 border-zinc-800 text-zinc-100 h-9 text-xs focus:ring-primary focus:border-primary">
              <SelectValue placeholder="Choose Job Campaign" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
              {jobs.map((j) => {
                const count = j.target === "products" || j.target === "brands"
                  ? j.progress.products_found || 0
                  : j.progress.processed_categories || 0;
                const unit = j.target === "products" ? "products" : j.target === "brands" ? "brands" : j.target === "categories" ? "categories" : "sub-categories";
                return (
                  <SelectItem key={j.job_id} value={j.job_id} className="cursor-pointer focus:bg-zinc-900 focus:text-zinc-100 py-1.5">
                    <span className="font-mono text-zinc-400 bg-zinc-900 border border-zinc-800/80 px-1 py-0.5 rounded text-[10px] mr-2">
                      {j.job_id.slice(0, 8)}
                    </span>
                    <span className="capitalize font-semibold text-zinc-200 mr-2">
                      {j.target.replace("-", " ")}:
                    </span>
                    <span className="text-primary font-bold text-xs">
                      {count} {unit}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1.5">Search SKU / ID / Name</label>
          <div className="relative">
            <Input
              type="text"
              value={expSearch}
              onChange={(e) => {
                setExpSearch(e.target.value);
                setExpPage(1);
              }}
              placeholder="Type query to filter..."
              className="w-full bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 h-9 pl-9 pr-3 text-xs focus:ring-1 focus:ring-primary focus:border-primary"
            />
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1.5">Category Slug</label>
          <Input
            type="text"
            value={expCategory}
            onChange={(e) => {
              setExpCategory(e.target.value);
              setExpPage(1);
            }}
            placeholder="e.g. medications"
            className="w-full bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 h-9 px-3 text-xs focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1.5">Brand Slug</label>
          <Input
            type="text"
            value={expBrand}
            onChange={(e) => {
              setExpBrand(e.target.value);
              setExpPage(1);
            }}
            placeholder="e.g. gsk"
            className="w-full bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 h-9 px-3 text-xs focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      {selectedJobIdForBrowse && (() => {
        const selectedJob = jobs.find((j) => j.job_id === selectedJobIdForBrowse);
        if (!selectedJob || selectedJob.target !== "products") return null;
        
        const mediaStatus = selectedJob.media_status || "none";
        if (mediaStatus === "completed") return null;

        const isRunning = mediaStatus === "running";
        const isFailed = mediaStatus === "failed";
        
        const completed = selectedJob.images_completed || 0;
        const total = selectedJob.images_total || 0;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        const handleFetchMedia = async () => {
          await triggerMediaFetch(selectedJob.job_id);
          router.push(`/dashboard/crawler?job_id=${selectedJob.job_id}`);
        };

        return (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-xl transition-all duration-300",
              isRunning
                ? "bg-sky-500/5 border-sky-500/20 shadow-md shadow-sky-500/5"
                : isFailed
                  ? "bg-rose-500/5 border-rose-500/20 shadow-md shadow-rose-500/5"
                  : "bg-amber-500/5 border-amber-500/20 shadow-md shadow-amber-500/5"
            )}
          >
            <div className="flex items-start gap-3 flex-1">
              <div className={cn(
                "p-2 rounded-xl border shrink-0 mt-0.5",
                isRunning
                  ? "bg-sky-950/65 border-sky-500/30 text-sky-400"
                  : isFailed
                    ? "bg-rose-950/65 border-rose-500/30 text-rose-400"
                    : "bg-amber-950/65 border-amber-500/30 text-amber-400"
              )}>
                {isRunning ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isFailed ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className={cn(
                    "text-xs font-extrabold uppercase tracking-wide",
                    isRunning ? "text-sky-400" : isFailed ? "text-rose-400" : "text-amber-400"
                  )}>
                    {isRunning
                      ? "Media Asset Fetching Stage Active"
                      : isFailed
                        ? "Local Media Image Fetch Failed"
                        : "Images Loaded from Chefaa CDN"}
                  </h4>
                  {isRunning && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full animate-pulse">
                      Processing Assets
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400 max-w-2xl leading-relaxed">
                  {isRunning
                    ? `Our media downloader is currently fetching product images from Chefaa servers and saving them locally. Progress: ${completed} / ${total} files.`
                    : isFailed
                      ? "The standalone image downloading process failed during execution. Some product images might display directly from Chefaa's CDN server. You can retry the process to retrieve missing files."
                      : "Product details and images are rendered live from the Chefaa CDN network. Media files have not yet been fetched locally for offline mapping or packaging."}
                </p>

                {isRunning && total > 0 && (
                  <div className="mt-2.5 max-w-md space-y-1">
                    <div className="flex justify-between text-[9px] font-bold font-mono text-sky-400">
                      <span>Downloading Images</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="bg-sky-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 flex gap-2 w-full md:w-auto justify-end">
              {isRunning ? (
                <Button
                  onClick={() => router.push(`/dashboard/crawler?job_id=${selectedJob.job_id}`)}
                  className="w-full md:w-auto h-9 bg-sky-500 hover:bg-sky-600 text-zinc-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 px-4 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  View Live Telemetry Logs
                </Button>
              ) : (
                <Button
                  onClick={handleFetchMedia}
                  className={cn(
                    "w-full md:w-auto h-9 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 px-4 cursor-pointer",
                    isFailed
                      ? "bg-rose-500 hover:bg-rose-600 text-zinc-950"
                      : "bg-amber-500 hover:bg-amber-600 text-zinc-950"
                  )}
                >
                  <CloudLightning className="w-3.5 h-3.5 fill-current" />
                  {isFailed ? "Retry Fetching Images" : "Run Image Fetcher Process"}
                </Button>
              )}
            </div>
          </motion.div>
        );
      })()}

      {/* Browsing results grid */}
      {selectedJobIdForBrowse ? (

        expLoading ? (
          <div className="h-[400px] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <span className="text-xs text-zinc-500">Querying crawled JSON dataset indexes...</span>
          </div>
        ) : explorerProducts.length === 0 ? (
          <div className="h-[300px] bg-zinc-900/10 border border-zinc-800/80 rounded-2xl flex items-center justify-center text-zinc-500 italic">
            No products matched current search filters in this campaign dataset.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {explorerProducts.map((prod) => {
                const selectedJob = jobs.find((j) => j.job_id === selectedJobIdForBrowse);
                const jobTarget = selectedJob?.target || "products";

                const prodId = prod.id || prod.slug || prod.url?.split("/").pop() || "unknown";
                const nameEn = prod.names?.en || prod.name || prodId;
                const nameAr = prod.names?.ar || "";
                const categoryName = prod.category?.names?.en || prod.category?.name || "General";
                const brandName = (typeof prod.brand === "object" && prod.brand !== null && (prod.brand.names?.en || prod.brand.name)) || (typeof prod.brand === "string" && prod.brand) || "Generic";

                if (jobTarget === "categories" || jobTarget === "sub-categories") {
                  const hrefVal = prod.href_slug || prod.href || "";
                  const cleanSlug = prod.slug || hrefVal.split("/").pop() || "unknown";
                  const subCount = prod.sub_categories?.length ?? 0;

                  return (
                    <div
                      key={cleanSlug}
                      onClick={() => {
                        setInspectItem(prod);
                        setCarouselIdx(0);
                      }}
                      className="group p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-lg cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        {/* Category Cover image container */}
                        <div className={cn("bg-zinc-950 rounded-lg border border-zinc-800/80 overflow-hidden mb-3.5 relative flex items-center justify-center",
                          jobTarget === "categories" ? "h-32" : "aspect-square"
                        )}>
                          {prod.cover_image ? (
                            <img
                              src={prod.cover_image}
                              alt={nameEn}
                              className="object-contain w-full p-2 group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 p-4 text-center">
                              <ImageIcon className="w-8 h-8 text-zinc-700" />
                              <span className="text-[10px] text-zinc-500 font-semibold italic">No Cover Scraped</span>
                            </div>
                          )}
                          <span className="absolute top-2 right-2 text-[9px] bg-zinc-900/90 text-zinc-400 py-0.5 px-2 rounded-full border border-zinc-800 font-bold">
                            {subCount > 0 ? `${subCount} Subcats` : "Category"}
                          </span>
                        </div>

                        {/* Label */}
                        <span className="text-[10px] text-primary uppercase tracking-wider font-bold block mb-1">
                          {jobTarget.replace("-", " ")}
                        </span>

                        {/* Localized Category names */}
                        <h3 className="text-xs font-bold text-zinc-200 line-clamp-1 group-hover:text-primary transition-colors">
                          {nameEn}
                        </h3>
                        {nameAr && (
                          <h4 className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5 font-sans text-right direction-rtl">
                            {nameAr}
                          </h4>
                        )}
                      </div>

                      {/* Href / Slug tags at bottom */}
                      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                        <span className="text-[9px] bg-zinc-950 py-0.5 px-2 rounded text-zinc-500 border border-zinc-800 max-w-[80%] truncate">
                          slug: {cleanSlug}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                }

                if (jobTarget === "brands") {
                  const hrefVal = prod.href_slug || prod.href || "";
                  const cleanSlug = prod.slug || hrefVal.split("/").pop() || "unknown";

                  return (
                    <div
                      key={cleanSlug}
                      onClick={() => {
                        setInspectItem(prod);
                        setCarouselIdx(0);
                      }}
                      className="group p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-lg cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        {/* Brand Logo image container */}
                        <div className="aspect-square bg-zinc-950 rounded-lg border border-zinc-800/80 overflow-hidden mb-3.5 relative flex items-center justify-center">
                          {prod.logo_url ? (
                            <div className="w-full h-full p-4 flex items-center justify-center bg-white group-hover:scale-[1.02] transition-transform duration-300">
                              <img
                                src={prod.logo_url}
                                alt={nameEn}
                                className="object-contain w-full h-full"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 p-4 text-center">
                              <ImageIcon className="w-8 h-8 text-zinc-700" />
                              <span className="text-[10px] text-zinc-500 font-semibold italic">No Logo Scraped</span>
                            </div>
                          )}
                          <span className="absolute top-2 right-2 text-[9px] bg-zinc-900/90 text-zinc-400 py-0.5 px-2 rounded-full border border-zinc-800 font-bold">
                            Brand
                          </span>
                        </div>

                        {/* Label */}
                        <span className="text-[10px] text-primary uppercase tracking-wider font-bold block mb-1">
                          Manufacturer / Brand
                        </span>

                        {/* Localized Brand names */}
                        <h3 className="text-xs font-bold text-zinc-200 line-clamp-1 group-hover:text-primary transition-colors">
                          {nameEn}
                        </h3>
                        {nameAr && (
                          <h4 className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5 font-sans text-right direction-rtl">
                            {nameAr}
                          </h4>
                        )}
                      </div>

                      {/* Href / Slug tags at bottom */}
                      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                        <span className="text-[9px] bg-zinc-950 py-0.5 px-2 rounded text-zinc-500 border border-zinc-800 max-w-[80%] truncate">
                          slug: {cleanSlug}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={prodId}
                    onClick={() => {
                      setInspectItem(prod);
                      setCarouselIdx(0);
                    }}
                    className="group p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-lg cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Product Thumbnail image */}
                      <div className="aspect-square bg-zinc-950 rounded-lg border border-zinc-800/80 overflow-hidden mb-3.5 relative flex items-center justify-center">
                        {prod.featured_image ? (
                          <img
                            src={prod.featured_image}
                            alt={nameEn}
                            className="object-contain w-full h-full p-2 group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-zinc-800" />
                        )}
                        <span className="absolute top-2 right-2 text-[9px] bg-zinc-900/90 text-zinc-400 py-0.5 px-2 rounded-full border border-zinc-800 font-bold">
                          {prod.price} {prod.currency || "EGP"}
                        </span>
                      </div>

                      {/* Brand */}
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                        {brandName}
                      </span>

                      {/* Localized Product names */}
                      <h3 className="text-xs font-bold text-zinc-200 line-clamp-1 group-hover:text-primary transition-colors">
                        {nameEn}
                      </h3>
                      {nameAr && (
                        <h4 className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5 font-sans text-right direction-rtl">
                          {nameAr}
                        </h4>
                      )}
                    </div>

                    {/* Tags summary at bottom */}
                    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                      <span className="text-[9px] bg-zinc-950 py-0.5 px-2 rounded text-zinc-500 border border-zinc-800">
                        {categoryName}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination using shadcn buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80">
              <span className="text-xs text-zinc-500">
                Showing <strong className="text-zinc-300">{(expPage - 1) * 24 + 1} - {Math.min(expPage * 24, expTotal)}</strong> of <strong className="text-zinc-300">{expTotal}</strong> products
              </span>

              <div className="inline-flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setExpPage((p) => Math.max(1, p - 1))}
                  disabled={expPage === 1}
                  className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 transition-all cursor-pointer h-9 w-9"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-bold font-mono h-9 flex items-center justify-center">
                  {expPage}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setExpPage((p) => Math.min(Math.ceil(expTotal / 24), p + 1))}
                  disabled={expPage >= Math.ceil(expTotal / 24)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 transition-all cursor-pointer h-9 w-9"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="h-[250px] bg-zinc-900/10 border border-zinc-800/80 rounded-2xl flex items-center justify-center text-zinc-500 italic">
          Select a historical campaign job from the dropdown menu to inspect its collected catalog items.
        </div>
      )}

      {/* FULL SCREEN DETAILED PRODUCT INSPECT DIALOG MODAL */}
      <AnimatePresence>
        {inspectItem && (() => {
          const selectedJob = jobs.find((j) => j.job_id === selectedJobIdForBrowse);
          const jobTarget = selectedJob?.target || "products";
          const mediaStatus = selectedJob?.media_status || "none";
          const nameEn = inspectItem.names?.en || inspectItem.name || inspectItem.id || "";

          const nameAr = inspectItem.names?.ar || "";
          const cleanSlug = inspectItem.slug || inspectItem.id || "";

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

              {/* Backdrop shadow overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setInspectItem(null)}
                className="absolute inset-0 bg-black"
              />

              {/* Modal Body Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 md:p-8 z-10 backdrop-blur-2xl"
              >
                <button
                  onClick={() => setInspectItem(null)}
                  className="absolute top-4 right-4 p-1.5 bg-zinc-950 rounded-lg border border-zinc-800 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                  {/* Images Gallery Panel */}
                  <div>
                    <div className="aspect-square bg-zinc-950 rounded-xl border border-zinc-800/80 overflow-hidden flex items-center justify-center relative mb-4">
                      {jobTarget === "categories" || jobTarget === "sub-categories" ? (
                        inspectItem.cover_image ? (
                          <img
                            src={inspectItem.cover_image}
                            alt={nameEn}
                            className="object-contain w-full h-full p-4"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 p-4 text-center">
                            <ImageIcon className="w-12 h-12 text-zinc-800" />
                            <span className="text-xs text-zinc-500 font-semibold italic">No Cover Scraped</span>
                          </div>
                        )
                      ) : jobTarget === "brands" ? (
                        inspectItem.logo_url ? (
                          <div className="w-full h-full p-6 flex items-center justify-center bg-white">
                            <img
                              src={inspectItem.logo_url}
                              alt={nameEn}
                              className="object-contain w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 p-4 text-center">
                            <ImageIcon className="w-12 h-12 text-zinc-800" />
                            <span className="text-xs text-zinc-500 font-semibold italic">No Logo Scraped</span>
                          </div>
                        )
                      ) : inspectItem.images && inspectItem.images.length > 0 ? (
                        <img
                          src={inspectItem.images[carouselIdx]}
                          alt="Product specification gallery"
                          className="object-contain w-full h-full p-4"
                        />
                      ) : inspectItem.featured_image ? (
                        <img
                          src={inspectItem.featured_image}
                          alt="Scraped primary thumbnail"
                          className="object-contain w-full h-full p-4"
                        />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-zinc-800" />
                      )}
                    </div>

                    {/* Slider thumbs */}
                    {jobTarget === "products" && inspectItem.images && inspectItem.images.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {inspectItem.images.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setCarouselIdx(i)}
                            className={`w-12 h-12 rounded border bg-zinc-950 p-0.5 overflow-hidden flex-shrink-0 cursor-pointer transition-all ${carouselIdx === i ? "border-primary scale-[1.03]" : "border-zinc-800"
                              }`}
                          >
                            <img src={img} alt="thumbnail" className="object-contain w-full h-full" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Localized metadata panel details */}
                  <div className="flex flex-col justify-between">
                    <div>
                      {/* Category Path info */}
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                        {jobTarget === "categories" || jobTarget === "sub-categories"
                          ? (jobTarget === "categories" ? "Main Category" : "Nested Sub-category")
                          : jobTarget === "brands"
                            ? "Storefront Manufacturer Brand"
                            : (inspectItem.category?.names?.en || inspectItem.category?.name || "General Category")}
                        {jobTarget === "products" && inspectItem.subcategory?.names?.en && ` / ${inspectItem.subcategory.names.en}`}
                      </span>

                      {/* Localized Name Tabs */}
                      <div className="flex border-b border-zinc-800 mb-4 text-xs font-semibold gap-4">
                        <button
                          onClick={() => setActiveLangTab("en")}
                          className={`pb-2 border-b-2 transition-all ${activeLangTab === "en" ? "border-primary text-primary font-bold" : "border-transparent text-zinc-400 hover:text-zinc-100"}`}
                        >
                          English Details
                        </button>
                        <button
                          onClick={() => setActiveLangTab("ar")}
                          className={`pb-2 border-b-2 transition-all ${activeLangTab === "ar" ? "border-primary text-primary font-bold" : "border-transparent text-zinc-400 hover:text-zinc-100"}`}
                        >
                          تفاصيل باللغة العربية
                        </button>
                      </div>

                      {activeLangTab === "en" ? (
                        <div>
                          <h2 className="text-xl font-extrabold text-zinc-100 mb-1">
                            {nameEn}
                          </h2>
                          <span className="text-xs text-zinc-400 italic block mb-4">
                            {jobTarget === "categories" || jobTarget === "sub-categories"
                              ? `Slug Key: ${cleanSlug}`
                              : jobTarget === "brands"
                                ? `Slug Key: ${cleanSlug}`
                                : `Brand: ${(typeof inspectItem.brand === "object" && inspectItem.brand !== null && (inspectItem.brand.names?.en || inspectItem.brand.name)) || (typeof inspectItem.brand === "string" && inspectItem.brand) || "Generic"}`}
                          </span>

                          {jobTarget === "products" ? (
                            <>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-primary" />
                                Overview
                              </h4>
                              <div
                                className="text-xs leading-relaxed text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 max-h-[140px] overflow-y-auto"
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml(
                                    (typeof inspectItem.overview === "object" && inspectItem.overview?.en) ||
                                    (typeof inspectItem.overview === "string" && inspectItem.overview) ||
                                    inspectItem.description ||
                                    "No overview details parsed for this language profile."
                                  )
                                }}
                              />
                            </>
                          ) : jobTarget === "categories" || jobTarget === "sub-categories" ? (
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-primary" />
                                Nested Sub-Categories ({inspectItem.sub_categories?.length ?? 0})
                              </h4>
                              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 max-h-[160px] overflow-y-auto">
                                {inspectItem.sub_categories && inspectItem.sub_categories.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {inspectItem.sub_categories.map((sub: any, idx: number) => (
                                      <span key={idx} className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 py-1 px-2.5 rounded-md font-medium">
                                        {sub.names?.en || sub.name || sub.slug}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-zinc-500 italic">No nested sub-categories listed.</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5 text-primary" />
                                Storefront Href Link
                              </h4>
                              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 font-mono text-[10px] text-zinc-400 break-all select-all">
                                {inspectItem.href_slug || inspectItem.href || `https://chefaa.com/brands/${cleanSlug}`}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="direction-rtl text-right">
                          <h2 className="text-xl font-extrabold text-zinc-100 mb-1 font-sans">
                            {nameAr || nameEn}
                          </h2>
                          <span className="text-xs text-zinc-400 italic block mb-4 font-sans font-medium">
                            {jobTarget === "categories" || jobTarget === "sub-categories"
                              ? `مفتاح المعرّف (Slug): ${cleanSlug}`
                              : jobTarget === "brands"
                                ? `مفتاح الماركة (Slug): ${cleanSlug}`
                                : `الماركة: ${(typeof inspectItem.brand === "object" && inspectItem.brand !== null && (inspectItem.brand.names?.ar || inspectItem.brand.names?.en || inspectItem.brand.name)) || (typeof inspectItem.brand === "string" && inspectItem.brand) || "غير محدد"}`}
                          </span>

                          {jobTarget === "products" ? (
                            <>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5 justify-end font-sans">
                                <FileText className="w-3.5 h-3.5 text-primary" />
                                نظرة عامة
                              </h4>
                              <div
                                className="text-xs leading-relaxed text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 max-h-[140px] overflow-y-auto font-sans"
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml(
                                    (typeof inspectItem.overview === "object" && inspectItem.overview?.ar) ||
                                    (typeof inspectItem.overview === "string" && inspectItem.overview) ||
                                    "لا توجد تفاصيل متوفرة للملف التعريفي باللغة العربية."
                                  )
                                }}
                              />
                            </>
                          ) : jobTarget === "categories" || jobTarget === "sub-categories" ? (
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5 justify-end font-sans">
                                <Layers className="w-3.5 h-3.5 text-primary" />
                                الفئات الفرعية ({inspectItem.sub_categories?.length ?? 0})
                              </h4>
                              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 max-h-[160px] overflow-y-auto font-sans text-right">
                                {inspectItem.sub_categories && inspectItem.sub_categories.length > 0 ? (
                                  <div className="flex flex-wrap gap-2 justify-start">
                                    {inspectItem.sub_categories.map((sub: any, idx: number) => (
                                      <span key={idx} className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 py-1 px-2.5 rounded-md font-medium">
                                        {sub.names?.ar || sub.names?.en || sub.name || sub.slug}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-zinc-500 italic font-sans">لا توجد فئات فرعية مدرجة.</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5 justify-end font-sans">
                                <Database className="w-3.5 h-3.5 text-primary" />
                                رابط المتجر الإلكتروني
                              </h4>
                              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 font-mono text-[10px] text-zinc-400 break-all select-all text-left">
                                {inspectItem.href_slug || inspectItem.href || `https://chefaa.com/brands/${cleanSlug}`}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Specifications and Price cards */}
                    <div className="mt-6">
                      {/* CDN note alert banner inside inspect modal */}
                      {jobTarget === "products" && mediaStatus !== "completed" && (
                        <div className={cn(
                          "p-3.5 rounded-xl border flex items-center justify-between gap-3 mb-4 text-xs backdrop-blur-md transition-all duration-300",
                          mediaStatus === "running"
                            ? "bg-sky-500/5 border-sky-500/20 text-sky-200"
                            : "bg-amber-500/5 border-amber-500/20 text-amber-200"
                        )}>
                          <div className="flex items-start gap-2.5">
                            {mediaStatus === "running" ? (
                              <Loader2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5 animate-spin" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className="font-bold block mb-0.5">
                                {mediaStatus === "running" ? "Fetching Media Locally..." : "Chefaa CDN Media Source"}
                              </span>
                              <p className="text-[10px] text-zinc-400 leading-normal">
                                {mediaStatus === "running"
                                  ? "The local image downloading process is currently running for this campaign."
                                  : "These product gallery images are loaded live from the Chefaa CDN network. Media files are not stored locally."}
                              </p>
                            </div>
                          </div>
                          {mediaStatus !== "running" && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (selectedJobIdForBrowse) {
                                  await triggerMediaFetch(selectedJobIdForBrowse);
                                  setInspectItem(null);
                                  router.push(`/dashboard/crawler?job_id=${selectedJobIdForBrowse}`);
                                }
                              }}
                              className="py-1 px-2.5 rounded bg-amber-500 hover:bg-amber-600 text-zinc-950 text-[10px] font-bold uppercase transition-all shrink-0 cursor-pointer"
                            >
                              Fetch
                            </button>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {jobTarget === "products" ? (
                          <>
                            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
                              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block mb-0.5">Price Listing</span>
                              <span className="text-sm font-extrabold text-primary">
                                {inspectItem.price} {inspectItem.currency || "EGP"}
                              </span>
                            </div>
                            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
                              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block mb-0.5">SKU slug</span>
                              <span className="text-xs font-mono font-bold text-zinc-300 truncate block">
                                {inspectItem.id}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
                              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block mb-0.5">Storefront Slug</span>
                              <span className="text-xs font-mono font-bold text-zinc-300 truncate block">
                                {cleanSlug}
                              </span>
                            </div>
                            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
                              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block mb-0.5">Scraped Link Route</span>
                              <span className="text-xs font-mono font-bold text-zinc-300 truncate block">
                                {inspectItem.href || inspectItem.href_slug || "N/A"}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Specification specs key-value table */}
                      {jobTarget === "products" && inspectItem.specification && Object.keys(inspectItem.specification).length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Specifications</h4>
                          <div className="bg-zinc-950 rounded-xl border border-zinc-800/80 overflow-hidden text-[11px]">
                            {Object.entries(inspectItem.specification).map(([key, val], idx) => (
                              <div key={key} className={`flex justify-between p-2.5 ${idx % 2 === 0 ? "bg-zinc-900/35" : ""} border-b border-zinc-900/50`}>
                                <span className="font-semibold text-zinc-400">{key}</span>
                                <span className="text-zinc-200">{val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

    </motion.div>
  );
}
