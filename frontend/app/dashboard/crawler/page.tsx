"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Square,
  Terminal,
  Database,
  Sliders,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Activity
} from "lucide-react";
import { motion } from "framer-motion";
import { cn, API_URL } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCrawler } from "./crawler-context";

function ActiveCrawlTimer({ job }: { job: any }) {
  const [elapsed, setElapsed] = React.useState<number>(0);

  React.useEffect(() => {
    if (!job) return;
    
    // If not running/pending, show static duration
    if (job.status !== "running" && job.status !== "pending") {
      if (job.duration) {
        setElapsed(job.duration);
      } else if (job.finished_at && job.started_at) {
        const diff = Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000);
        setElapsed(Math.max(0, diff));
      } else if (job.updated_at && job.created_at) {
        const diff = Math.round((new Date(job.updated_at).getTime() - new Date(job.created_at).getTime()) / 1000);
        setElapsed(Math.max(0, diff));
      }
      return;
    }

    // Otherwise, tick every second
    const startIso = job.started_at || job.created_at;
    const startMs = new Date(startIso).getTime();

    const updateTimer = () => {
      const nowMs = new Date().getTime();
      const diffSec = Math.round((nowMs - startMs) / 1000);
      setElapsed(Math.max(0, diffSec));
    };

    updateTimer(); // run once immediately
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [job]);

  const formatElapsed = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (n: number) => String(n).padStart(2, "0");

    if (hrs > 0) {
      return `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;
    }
    return `${pad(mins)}m ${pad(secs)}s`;
  };

  return (
    <span className="text-2xl font-bold font-mono text-amber-400">
      {formatElapsed(elapsed)}
    </span>
  );
}

export default function OrchestratePage() {
  const router = useRouter();
  const terminalRef = useRef<HTMLDivElement>(null);

  const {
    target,
    setTarget,
    categoryHref,
    setCategoryHref,
    country,
    setCountry,
    lang,
    setLang,
    deep,
    setDeep,
    download,
    setDownload,
    includeMedia,
    setIncludeMedia,
    statsOnly,
    setStatsOnly,
    pages,
    setPages,
    showParamsForm,
    setShowParamsForm,
    workers,
    setWorkers,
    crawlMode,
    setCrawlMode,
    useCurrentDb,
    setUseCurrentDb,
    jobs,
    activeJobId,
    setActiveJobId,
    logs,
    progressMetrics,
    isCrawlLoading,
    handleStartCampaign,
    handleStopCampaign,
    triggerMediaFetch,
    setSelectedJobIdForBrowse,
    parseAnsiToHtml
  } = useCrawler();

  const [diagData, setDiagData] = React.useState<any>(null);
  const [diagLoading, setDiagLoading] = React.useState(false);

  // Campaign Preset states
  const [isAdvancedMode, setIsAdvancedMode] = React.useState(false);
  const [activePreset, setActivePreset] = React.useState<
    | "all-products"
    | "all-brands"
    | "all-categories"
    | "first-n-categories"
    | "n-pages-of-n-categories"
    | "resource-stats"
    | null
  >("all-products");
  const [presetN, setPresetN] = React.useState<number>(5);
  const [presetPages, setPresetPages] = React.useState<number>(1);

  const [categoryScope, setCategoryScope] = React.useState<"all" | "quick-5" | "custom">(() => {
    if (categoryHref === "all") return "all";
    if (categoryHref === "quick-5") return "quick-5";
    return "custom";
  });

  const [customPath, setCustomPath] = React.useState(() => {
    if (categoryHref !== "all" && categoryHref !== "quick-5") return categoryHref;
    return "medications";
  });

  React.useEffect(() => {
    if (categoryHref === "all") {
      setCategoryScope("all");
    } else if (categoryHref === "quick-5") {
      setCategoryScope("quick-5");
    } else {
      setCategoryScope("custom");
      setCustomPath(categoryHref);
    }
  }, [categoryHref]);

  // Unified Advanced-Mode reactive rules and constraints cascade
  React.useEffect(() => {
    if (statsOnly) {
      setDeep(false);
      setDownload(false);
      setIncludeMedia(false);
      return;
    }

    if (target === "products") {
      if (crawlMode === "catalog") {
        setDownload(false);
      }
    } else {
      // Brands & Categories
      if (!includeMedia) {
        setDownload(false);
      }
    }
  }, [target, statsOnly, crawlMode, includeMedia, setDeep, setDownload, setIncludeMedia]);

  // Handler to cascade includeMedia when download is checked in Brands/Categories mode
  const handleDownloadToggle = (checked: boolean) => {
    setDownload(checked);
    if (checked && target !== "products") {
      setIncludeMedia(true);
    }
  };

  const onSubmitStartCampaign = () => {
    if (!isAdvancedMode && activePreset) {
      const payload = {
        preset: activePreset,
        preset_n: activePreset === "first-n-categories" || activePreset === "n-pages-of-n-categories" ? presetN : undefined,
        preset_pages: activePreset === "n-pages-of-n-categories" ? presetPages : undefined,
        country,
        lang,
        localize: lang === "both",
        background: true,
        deep: true,
        workers: 1,
        crawl_mode: ["all-products", "first-n-categories", "n-pages-of-n-categories"].includes(activePreset) ? crawlMode : "catalog",
        use_current_db: useCurrentDb
      };
      handleStartCampaign(payload);
    } else {
      handleStartCampaign();
    }
  };

  const runDiagnostics = async () => {
    setDiagLoading(true);
    setDiagData(null);
    try {
      const res = await fetch(`${API_URL}/api/crawler/diagnose?country=${country}`);
      const data = await res.json();
      if (data.success) {
        setDiagData(data);
      } else {
        alert("Diagnostics failed: " + data.error);
      }
    } catch (err: any) {
      alert("Diagnostics failed: " + err.message);
    } finally {
      setDiagLoading(false);
    }
  };

  // Scroll terminal logs to bottom smart autoscroll
  useEffect(() => {
    const el = terminalRef.current;
    if (el) {
      // Check if user is scrolled close to the bottom (within 100px)
      const threshold = 100;
      const isCloseToBottom = el.scrollHeight - el.clientHeight - el.scrollTop < threshold;
      
      // If close to bottom or it's the very first logs load, autoscroll down
      if (isCloseToBottom || el.scrollTop === 0) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [logs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
    >
      {!showParamsForm ? (
        /* Campaign Control Center Panel */
        <div className="lg:col-span-1 p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl shadow-xl flex flex-col justify-between min-h-[480px]">
          {(() => {
            const latestJob = jobs.find((j) => j.job_id === activeJobId) || jobs[0];
            const isRunning = latestJob?.status === "running" || latestJob?.status === "pending";

            return (
              <>
                <div className="flex-1 flex flex-col justify-center items-center text-center p-4">
                  {isRunning ? (
                    /* RUNNING STATE */
                    <div className="flex flex-col items-center">
                      {/* Pulsing animation */}
                      <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                        <div className="absolute inset-2 bg-primary/10 rounded-full animate-pulse" />
                        <div className="w-12 h-12 bg-zinc-950 rounded-full border border-primary flex items-center justify-center">
                          <RefreshCw className="w-6 h-6 text-primary animate-spin" style={{ animationDuration: '4s' }} />
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-zinc-100 mb-1">Scrape Campaign Active</h3>
                      <p className="text-xs text-zinc-400 max-w-[200px] mb-4">
                        Currently fetching catalog datasets for <strong>{latestJob?.target}</strong> in the background...
                      </p>

                      <div className="text-[10px] uppercase font-semibold text-zinc-500 bg-zinc-950/80 py-1.5 px-3 rounded-lg border border-zinc-900">
                        Target Storefront: <span className="text-zinc-300 font-mono font-bold ml-1">{latestJob?.params?.country?.toUpperCase()} / {latestJob?.params?.lang?.toUpperCase()}</span>
                      </div>
                    </div>
                  ) : (
                    /* FINISHED / COMPLETED / STOPPED / FAILED STATE */
                    <div className="flex flex-col items-center">
                      <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                        {latestJob?.status === "completed" ? (
                          <>
                            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-pulse" />
                            <div className="w-12 h-12 bg-zinc-950 rounded-full border border-emerald-500 flex items-center justify-center">
                              <CheckCircle className="w-6 h-6 text-emerald-400" />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-rose-500/20 rounded-full animate-pulse" />
                            <div className="w-12 h-12 bg-zinc-950 rounded-full border border-rose-500 flex items-center justify-center">
                              <AlertCircle className="w-6 h-6 text-rose-400" />
                            </div>
                          </>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-zinc-100 mb-1">
                        {latestJob?.status === "completed" ? "Scrape Campaign Success" : "Campaign Terminated"}
                      </h3>
                      <p className="text-xs text-zinc-400 max-w-[200px] mb-4 text-center">
                        {latestJob?.status === "completed"
                          ? "All parsed catalog datasets have been successfully updated in database index."
                          : latestJob?.error_msg || "Execution stopped by supervisor command."}
                      </p>

                      <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-900 w-full mb-2">
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider mb-1">Scraped Target</span>
                        <span className="text-xs font-mono font-bold text-zinc-300 capitalize">{latestJob?.target}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* BOTTOM ACTION BUTTONS */}
                <div className="flex flex-col gap-2.5 mt-auto pt-6 border-t border-zinc-900/60 w-full">
                  {!isRunning && (
                    <button
                      onClick={() => {
                        if (latestJob?.job_id) {
                          setSelectedJobIdForBrowse(latestJob.job_id);
                          router.push(`/dashboard/crawler/explorer?job_id=${latestJob.job_id}`);
                        }

                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-500/90 hover:to-teal-600/90 text-black font-extrabold rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider font-bold"
                    >
                      <Database className="w-4 h-4 text-zinc-950 font-bold" />
                      See Results Explorer
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowParamsForm(true);
                      setActiveJobId(null);
                    }}
                    className={`w-full py-2.5 font-bold rounded-xl border transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider ${isRunning
                      ? "bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700"
                      : "bg-primary-dark text-white border-transparent hover:bg-primary-dark/90 shadow-lg shadow-primary/10"
                      }`}
                  >
                    <Sliders className="w-4 h-4" />
                    {isRunning ? "Change parameters / Settings" : "Run Another Campaign"}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        /* Parameter Settings Form */
        <div className="lg:col-span-1 p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            {!isAdvancedMode ? (
              /* Campaign Preset Selector View */
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                  <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    Campaign Presets
                  </h2>
                  <span 
                    onClick={() => setIsAdvancedMode(true)}
                    className="text-[10px] text-primary hover:text-primary-dark underline cursor-pointer transition-colors"
                  >
                    Advanced Mode ↓
                  </span>
                </div>

                {/* Production Group */}
                <div className="space-y-2">
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Production Fetchers</div>
                  <div className="grid grid-cols-1 gap-2">
                    {/* card: Fetch All Products */}
                    <div
                      onClick={() => setActivePreset("all-products")}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col justify-between select-none cursor-pointer transition-all duration-300",
                        activePreset === "all-products"
                          ? "bg-primary-dark/[0.04] border-primary-dark/60 shadow-md shadow-primary-deep/5"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full border flex items-center justify-center transition-all duration-300",
                          activePreset === "all-products" ? "border-primary" : "border-zinc-700"
                        )}>
                          {activePreset === "all-products" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                        <span className="text-xs font-semibold text-zinc-200">Fetch All Products</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1 font-normal leading-normal">
                        Crawls every product across all categories and subcategories. Expected: 20–60 min.
                      </p>
                    </div>

                    {/* card: Fetch All Brands */}
                    <div
                      onClick={() => setActivePreset("all-brands")}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col justify-between select-none cursor-pointer transition-all duration-300",
                        activePreset === "all-brands"
                          ? "bg-primary-dark/[0.04] border-primary-dark/60 shadow-md shadow-primary-deep/5"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full border flex items-center justify-center transition-all duration-300",
                          activePreset === "all-brands" ? "border-primary" : "border-zinc-700"
                        )}>
                          {activePreset === "all-brands" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                        <span className="text-xs font-semibold text-zinc-200">Fetch All Brands</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1 font-normal leading-normal">
                        Fetches the full manufacturer brand index. Expected: &lt; 1 min.
                      </p>
                    </div>

                    {/* card: Fetch All Categories */}
                    <div
                      onClick={() => setActivePreset("all-categories")}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col justify-between select-none cursor-pointer transition-all duration-300",
                        activePreset === "all-categories"
                          ? "bg-primary-dark/[0.04] border-primary-dark/60 shadow-md shadow-primary-deep/5"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full border flex items-center justify-center transition-all duration-300",
                          activePreset === "all-categories" ? "border-primary" : "border-zinc-700"
                        )}>
                          {activePreset === "all-categories" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                        <span className="text-xs font-semibold text-zinc-200">Fetch All Categories</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1 font-normal leading-normal">
                        Fetches all main and nested category nodes. Expected: &lt; 1 min.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Testing Group */}
                <div className="space-y-2 pt-2">
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Testing Fetchers</div>
                  <div className="grid grid-cols-1 gap-2">
                    {/* card: Fetch first N categories */}
                    <div
                      onClick={() => setActivePreset("first-n-categories")}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col select-none cursor-pointer transition-all duration-300",
                        activePreset === "first-n-categories"
                          ? "bg-primary-dark/[0.04] border-primary-dark/60 shadow-md shadow-primary-deep/5"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full border flex items-center justify-center transition-all duration-300",
                          activePreset === "first-n-categories" ? "border-primary" : "border-zinc-700"
                        )}>
                          {activePreset === "first-n-categories" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                        <span className="text-xs font-semibold text-zinc-200">Fetch first N categories</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1 font-normal leading-normal">
                        Crawls page 1 of the first N major parent categories. Expected: ~N × 5–10s.
                      </p>
                      {activePreset === "first-n-categories" && (
                        <div className="mt-2.5 flex items-center gap-2 self-start" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] text-zinc-400">Categories (N):</span>
                          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg h-7">
                            <button 
                              type="button"
                              onClick={() => setPresetN(Math.max(1, presetN - 1))}
                              className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs font-bold transition-all hover:bg-zinc-900 rounded-l-lg"
                            >
                              −
                            </button>
                            <input 
                              type="number"
                              min="1"
                              value={presetN}
                              onChange={(e) => setPresetN(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-10 text-center bg-transparent border-0 text-zinc-200 text-xs font-semibold focus:ring-0 focus:outline-none p-0 h-full"
                            />
                            <button 
                              type="button"
                              onClick={() => setPresetN(presetN + 1)}
                              className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs font-bold transition-all hover:bg-zinc-900 rounded-r-lg"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* card: Fetch N pages of N categories */}
                    <div
                      onClick={() => setActivePreset("n-pages-of-n-categories")}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col select-none cursor-pointer transition-all duration-300",
                        activePreset === "n-pages-of-n-categories"
                          ? "bg-primary-dark/[0.04] border-primary-dark/60 shadow-md shadow-primary-deep/5"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full border flex items-center justify-center transition-all duration-300",
                          activePreset === "n-pages-of-n-categories" ? "border-primary" : "border-zinc-700"
                        )}>
                          {activePreset === "n-pages-of-n-categories" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                        <span className="text-xs font-semibold text-zinc-200">Fetch N pages of N categories</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1 font-normal leading-normal">
                        Crawls up to P pages of the first N major categories. Expected: ~N × P × 5s.
                      </p>
                      {activePreset === "n-pages-of-n-categories" && (
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-400">Pages (P):</span>
                            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg h-7">
                              <button 
                                type="button"
                                onClick={() => setPresetPages(Math.max(1, presetPages - 1))}
                                className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs font-bold transition-all hover:bg-zinc-900 rounded-l-lg"
                              >
                                −
                              </button>
                              <input 
                                type="number"
                                min="1"
                                value={presetPages}
                                onChange={(e) => setPresetPages(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-8 text-center bg-transparent border-0 text-zinc-200 text-xs font-semibold focus:ring-0 focus:outline-none p-0 h-full"
                              />
                              <button 
                                type="button"
                                onClick={() => setPresetPages(presetPages + 1)}
                                className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs font-bold transition-all hover:bg-zinc-900 rounded-r-lg"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-400">Categories (N):</span>
                            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg h-7">
                              <button 
                                type="button"
                                onClick={() => setPresetN(Math.max(1, presetN - 1))}
                                className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs font-bold transition-all hover:bg-zinc-900 rounded-l-lg"
                              >
                                −
                              </button>
                              <input 
                                type="number"
                                min="1"
                                value={presetN}
                                onChange={(e) => setPresetN(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-8 text-center bg-transparent border-0 text-zinc-200 text-xs font-semibold focus:ring-0 focus:outline-none p-0 h-full"
                              />
                              <button 
                                type="button"
                                onClick={() => setPresetN(presetN + 1)}
                                className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs font-bold transition-all hover:bg-zinc-900 rounded-r-lg"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* card: Resource Stats */}
                    <div
                      onClick={() => setActivePreset("resource-stats")}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col justify-between select-none cursor-pointer transition-all duration-300",
                        activePreset === "resource-stats"
                          ? "bg-primary-dark/[0.04] border-primary-dark/60 shadow-md shadow-primary-deep/5"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full border flex items-center justify-center transition-all duration-300",
                          activePreset === "resource-stats" ? "border-primary" : "border-zinc-700"
                        )}>
                          {activePreset === "resource-stats" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                        <span className="text-xs font-semibold text-zinc-200">Fetch Resource Stats</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1 font-normal leading-normal">
                        Reads index counters from the local database. Expected: &lt; 2s.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Storefront, Language, and Crawl Mode Settings in Preset Mode */}
                <div className="space-y-3 pt-3 border-t border-zinc-800/60">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="block text-[10px] text-zinc-400 font-semibold mb-1">Country Storefront</Label>
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger className="w-full h-8 bg-zinc-950/50 border-zinc-800/80 text-zinc-200 text-xs">
                          <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs">
                          <SelectItem value="eg">Egypt (EGP)</SelectItem>
                          <SelectItem value="sa">Saudi Arabia (SAR)</SelectItem>
                          <SelectItem value="ae">UAE (AED)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="block text-[10px] text-zinc-400 font-semibold mb-1">Target Language</Label>
                      <Select value={lang} onValueChange={setLang}>
                        <SelectTrigger className="w-full h-8 bg-zinc-950/50 border-zinc-800/80 text-zinc-200 text-xs">
                          <SelectValue placeholder="Language" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs">
                          <SelectItem value="both">Both (Consolidated)</SelectItem>
                          <SelectItem value="en">English (en)</SelectItem>
                          <SelectItem value="ar">Arabic (ar)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Expose Dual-Stage Image Processing selector in Preset Mode for complete control! */}
                  {activePreset && ["all-products", "first-n-categories", "n-pages-of-n-categories"].includes(activePreset) && (
                    <div className="animate-in fade-in duration-300">
                      <Label className="block text-[10px] text-zinc-400 font-semibold mb-1">Image Processing Strategy</Label>
                      <Select value={crawlMode} onValueChange={setCrawlMode}>
                        <SelectTrigger className="w-full h-8 bg-zinc-950/50 border-zinc-800/80 text-zinc-200 text-xs">
                          <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200 text-xs">
                          <SelectItem value="catalog">Phase 1: Catalog Harvest Only (High Speed)</SelectItem>
                          <SelectItem value="both">Dual-Stage: Harvest + Image Stage (Complete)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Expose Use Current DB selector in Preset Mode for premium deduplication and caching! */}
                  {activePreset && ["all-products", "first-n-categories", "n-pages-of-n-categories"].includes(activePreset) && (
                    <div
                      onClick={() => setUseCurrentDb(!useCurrentDb)}
                      className={cn(
                        "p-3 rounded-xl border flex items-start gap-3 select-none transition-all duration-300 cursor-pointer animate-in fade-in duration-300",
                        useCurrentDb
                          ? "bg-primary-dark/[0.04] border-primary-dark/50 shadow-md shadow-primary-deep/5"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                      )}
                    >
                      <Checkbox
                        id="preset-use-current-db"
                        checked={useCurrentDb}
                        onCheckedChange={(checked) => setUseCurrentDb(checked === true)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-zinc-800 bg-zinc-950 w-4 h-4 mt-0.5 data-[state=checked]:bg-primary-dark data-[state=checked]:border-primary-dark"
                      />
                      <Label
                        htmlFor="preset-use-current-db"
                        className="flex flex-col gap-0.5 leading-tight cursor-pointer text-zinc-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-full text-xs font-semibold transition-colors">Use Current DB</div>
                        <p className="text-[10px] text-zinc-500 font-normal">Use current stored database as local cache to avoid fetching duplicates</p>
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Campaign Advanced Parameters Form */
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-zinc-800 mb-4">
                  <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    Advanced settings
                  </h2>
                  <span 
                    onClick={() => setIsAdvancedMode(false)}
                    className="text-[10px] text-primary hover:text-primary-dark underline cursor-pointer transition-colors"
                  >
                    Presets Mode ↑
                  </span>
                </div>

                {/* Scrape Target */}
                <div className="mb-4">
                  <Label className="block text-xs text-zinc-400 font-semibold mb-1.5">Scraping Target</Label>
                  <Select value={target} onValueChange={setTarget}>
                    <SelectTrigger className="w-full h-9 bg-zinc-950/50 border-zinc-800/80 text-zinc-200">
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                      <SelectItem value="products">Products</SelectItem>
                      <SelectItem value="brands">Brands</SelectItem>
                      <SelectItem value="categories">Categories (Overview Only)</SelectItem>
                      <SelectItem value="sub-categories">Categories & Nested Sub-Categories</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Stats Summary Only Banner Notice */}
                {statsOnly && (
                  <div className="mb-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[10px] text-amber-500 flex items-start gap-2 animate-in fade-in duration-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-normal">
                      Stats Only retrieves index counts straight from local database caches. Real-time crawling is offline.
                    </span>
                  </div>
                )}

                {/* Decoupled Crawl Mode selector */}
                {!statsOnly && target === "products" && (
                  <div className="mb-4 animate-in fade-in duration-200">
                    <Label className="block text-xs text-zinc-400 font-semibold mb-1.5">Image Processing Strategy</Label>
                    <Select value={crawlMode} onValueChange={setCrawlMode}>
                      <SelectTrigger className="w-full h-9 bg-zinc-950/50 border-zinc-800/80 text-zinc-200">
                        <SelectValue placeholder="Select image processing" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                        <SelectItem value="catalog">Phase 1: Catalog Harvest Only (High Speed)</SelectItem>
                        <SelectItem value="both">Dual-Stage: Harvest + Image Stage (Complete)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Category Scope Selection */}
                {!statsOnly && target === "products" && (
                  <div className="mb-4 space-y-4 animate-in fade-in duration-200">
                    <div>
                      <Label className="block text-xs text-zinc-400 font-semibold mb-1.5">Category Scope</Label>
                      <Select 
                        value={categoryScope} 
                        onValueChange={(val: "all" | "quick-5" | "custom") => {
                          setCategoryScope(val);
                          if (val === "all") {
                            setCategoryHref("all");
                          } else if (val === "quick-5") {
                            setCategoryHref("quick-5");
                            setPages("1"); // Auto-switch to 1 page for super fast crawl
                          } else {
                            setCategoryHref(customPath);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full h-9 bg-zinc-950/50 border-zinc-800/80 text-zinc-200">
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                          <SelectItem value="all">All Categories (Full Harvest)</SelectItem>
                          <SelectItem value="quick-5">Quick Test (5 Main Categories)</SelectItem>
                          <SelectItem value="custom">Single Custom Category Path</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                        {categoryScope === "all" && "Crawls all main categories and their nested subcategories (~20m)."}
                        {categoryScope === "quick-5" && "Crawls page 1 of only 5 major parent categories. Perfect for fast validation (~30s)."}
                        {categoryScope === "custom" && "Specify a custom relative sub-route path to crawl."}
                      </p>
                    </div>

                    {categoryScope === "custom" && (
                      <div className="animate-in slide-in-from-top-2 duration-200">
                        <Label className="block text-xs text-zinc-400 font-semibold mb-1.5">Custom Category Path</Label>
                        <Input
                          type="text"
                          value={customPath}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomPath(val);
                            setCategoryHref(val);
                          }}
                          placeholder="e.g. medications"
                          className="w-full h-9 bg-zinc-950/50 border-zinc-800/80 text-zinc-200 placeholder:text-zinc-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Country/Language Selection */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="block text-xs text-zinc-400 font-semibold mb-1.5">Country Storefront</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger className="w-full h-9 bg-zinc-950/50 border-zinc-800/80 text-zinc-200">
                        <SelectValue placeholder="Country" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                        <SelectItem value="eg">Egypt (EGP)</SelectItem>
                        <SelectItem value="sa">Saudi Arabia (SAR)</SelectItem>
                        <SelectItem value="ae">UAE (AED)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="block text-xs text-zinc-400 font-semibold mb-1.5">Target Language</Label>
                    <Select value={lang} onValueChange={setLang}>
                      <SelectTrigger className="w-full h-9 bg-zinc-950/50 border-zinc-800/80 text-zinc-200">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                        <SelectItem value="both">Both (Consolidated)</SelectItem>
                        <SelectItem value="en">English (en)</SelectItem>
                        <SelectItem value="ar">Arabic (ar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Pages Limitation */}
                {!statsOnly && target === "products" && (
                  <div className="mb-6 animate-in fade-in duration-200">
                    <Label className="block text-xs text-zinc-400 font-semibold mb-1.5">Pages Range</Label>
                    <Select value={pages} onValueChange={setPages}>
                      <SelectTrigger className="w-full h-9 bg-zinc-950/50 border-zinc-800/80 text-zinc-200">
                        <SelectValue placeholder="Pages range" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                        <SelectItem value="1">1 Page (Dry Run / Quick Check)</SelectItem>
                        <SelectItem value="1-5">1-5 Pages</SelectItem>
                        <SelectItem value="1-20">1-20 Pages</SelectItem>
                        <SelectItem value="1-50">1-50 Pages</SelectItem>
                        <SelectItem value="all">Fetch All Available Pages (Night Run)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Concurrency Control */}
                {!statsOnly && target === "products" && (
                  <div className="mb-6 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center mb-1.5">
                      <Label className="text-xs text-zinc-400 font-semibold">Concurrency Control</Label>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-emerald-400 font-bold border border-zinc-800">
                        {workers} Threads
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="16"
                        value={workers}
                        onChange={(e) => setWorkers(parseInt(e.target.value))}
                        className="w-full accent-primary h-1 bg-zinc-950 rounded-lg cursor-pointer appearance-none border border-zinc-800"
                      />
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-1.5 leading-normal">
                      Higher thread counts speed up specifications crawling but increase target server load. (Safest: 4)
                    </p>
                  </div>
                )}

                {/* Dynamic Switches */}
                <div className="space-y-3 pb-4">
                  {!statsOnly && target === "products" && (
                    <div
                      onClick={() => setDeep(!deep)}
                      className={cn(
                        "p-3 rounded-xl border flex items-start gap-3 select-none transition-all duration-300 cursor-pointer animate-in fade-in duration-200",
                        deep
                          ? "bg-primary-dark/[0.04] border-primary-dark/50 shadow-md shadow-primary-deep/5"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                      )}
                    >
                      <Checkbox
                        id="deep-specs"
                        checked={deep}
                        onCheckedChange={(checked) => setDeep(checked === true)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-zinc-800 bg-zinc-950 w-4 h-4 mt-0.5 data-[state=checked]:bg-primary-dark data-[state=checked]:border-primary-dark"
                      />
                      <Label
                        htmlFor="deep-specs"
                        className="flex flex-col gap-0.5 leading-tight cursor-pointer text-zinc-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-full text-xs font-semibold transition-colors">Deep Specifications Scrape</div>
                        <p className="text-[10px] text-zinc-500 font-normal">Fetch detail specs, HTML overview, multiple images</p>
                      </Label>
                    </div>
                  )}

                  {!statsOnly && target === "products" && (
                    <div
                      onClick={() => setUseCurrentDb(!useCurrentDb)}
                      className={cn(
                        "p-3 rounded-xl border flex items-start gap-3 select-none transition-all duration-300 cursor-pointer animate-in fade-in duration-200",
                        useCurrentDb
                          ? "bg-primary-dark/[0.04] border-primary-dark/50 shadow-md shadow-primary-deep/5"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                      )}
                    >
                      <Checkbox
                        id="advanced-use-current-db"
                        checked={useCurrentDb}
                        onCheckedChange={(checked) => setUseCurrentDb(checked === true)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-zinc-800 bg-zinc-950 w-4 h-4 mt-0.5 data-[state=checked]:bg-primary-dark data-[state=checked]:border-primary-dark"
                      />
                      <Label
                        htmlFor="advanced-use-current-db"
                        className="flex flex-col gap-0.5 leading-tight cursor-pointer text-zinc-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-full text-xs font-semibold transition-colors">Use Current DB</div>
                        <p className="text-[10px] text-zinc-500 font-normal">Use current stored database as local cache to avoid fetching duplicates</p>
                      </Label>
                    </div>
                  )}

                  {!statsOnly && target !== "products" && (
                    <div
                      onClick={() => setIncludeMedia(!includeMedia)}
                      className={cn(
                        "p-3 rounded-xl border flex items-start gap-3 select-none transition-all duration-300 cursor-pointer animate-in fade-in duration-200",
                        includeMedia
                          ? "bg-primary-dark/[0.04] border-primary-dark/50 shadow-md shadow-primary-deep/5"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                      )}
                    >
                      <Checkbox
                        id="include-media"
                        checked={includeMedia}
                        onCheckedChange={(checked) => setIncludeMedia(checked === true)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-zinc-800 bg-zinc-950 w-4 h-4 mt-0.5 data-[state=checked]:bg-primary-dark data-[state=checked]:border-primary-dark"
                      />
                      <Label
                        htmlFor="include-media"
                        className="flex flex-col gap-0.5 leading-tight cursor-pointer text-zinc-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-full text-xs font-semibold transition-colors">Include Media</div>
                        <p className="text-[10px] text-zinc-500 font-normal">
                          {target === "brands"
                            ? "Fetch brand logo images during execution"
                            : "Fetch category and sub-category cover images"}
                        </p>
                      </Label>
                    </div>
                  )}

                  {/* Download Media Switch with reactive rules and badges */}
                  <div
                    onClick={() => {
                      const isDownloadDisabled = statsOnly || 
                        (target === "products" && crawlMode === "catalog") || 
                        (target !== "products" && !includeMedia);
                      if (!isDownloadDisabled) {
                        handleDownloadToggle(!download);
                      }
                    }}
                    className={cn(
                      "p-3 rounded-xl border flex items-start gap-3 select-none transition-all duration-300",
                      statsOnly || 
                      (target === "products" && crawlMode === "catalog") || 
                      (target !== "products" && !includeMedia)
                        ? "bg-zinc-950/10 border-zinc-900 text-zinc-600 cursor-not-allowed opacity-50"
                        : download
                          ? "bg-primary-dark/[0.04] border-primary-dark/50 shadow-md shadow-primary-deep/5 cursor-pointer"
                          : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80 cursor-pointer"
                    )}
                  >
                    <Checkbox
                      id="download-media"
                      checked={statsOnly ? false : download}
                      disabled={
                        statsOnly || 
                        (target === "products" && crawlMode === "catalog") || 
                        (target !== "products" && !includeMedia)
                      }
                      onCheckedChange={(checked) => handleDownloadToggle(checked === true)}
                      onClick={(e) => e.stopPropagation()}
                      className="border-zinc-800 bg-zinc-950 w-4 h-4 mt-0.5 data-[state=checked]:bg-primary-dark data-[state=checked]:border-primary-dark disabled:opacity-40"
                    />
                    <Label
                      htmlFor="download-media"
                      className={cn(
                        "flex flex-col gap-0.5 leading-tight",
                        statsOnly || 
                        (target === "products" && crawlMode === "catalog") || 
                        (target !== "products" && !includeMedia)
                          ? "cursor-not-allowed text-zinc-600"
                          : "cursor-pointer text-zinc-200"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap items-center">
                        <span className="text-xs font-semibold">Download Media Files</span>
                        {target === "products" && crawlMode === "catalog" && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse ml-2">
                            <AlertCircle className="w-2.5 h-2.5 text-amber-500" />
                            Requires Dual-Stage Mode
                          </span>
                        )}
                        {target !== "products" && !includeMedia && !statsOnly && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse ml-2">
                            <AlertCircle className="w-2.5 h-2.5 text-amber-500" />
                            Requires Include Media
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-normal">Download and categorize image assets locally</p>
                    </Label>
                  </div>

                  <div
                    onClick={() => setStatsOnly(!statsOnly)}
                    className={cn(
                      "p-3 rounded-xl border cursor-pointer transition-all duration-300 flex items-start gap-3 select-none",
                      statsOnly
                        ? "bg-primary-dark/[0.04] border-primary-dark/50 shadow-md shadow-primary-deep/5"
                        : "bg-zinc-950/20 border-zinc-800/80 hover:bg-zinc-900/20 hover:border-zinc-700/80"
                    )}
                  >
                    <Checkbox
                      id="stats-only"
                      checked={statsOnly}
                      onCheckedChange={(checked) => setStatsOnly(checked === true)}
                      onClick={(e) => e.stopPropagation()}
                      className="border-zinc-800 bg-zinc-950 w-4 h-4 mt-0.5 data-[state=checked]:bg-primary-dark data-[state=checked]:border-primary-dark"
                    />
                    <Label htmlFor="stats-only" className="flex flex-col gap-0.5 cursor-pointer leading-tight" onClick={(e) => e.stopPropagation()}>
                      <div className="w-full text-xs font-semibold text-zinc-200 transition-colors">Stats Summary Only</div>
                      <p className="text-[10px] text-zinc-500 font-normal">Calculate category item counts inside database only</p>
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Trigger Action */}
          <Button
            onClick={onSubmitStartCampaign}
            disabled={isCrawlLoading}
            className="w-full py-5 rounded-xl text-white font-bold text-xs bg-primary-dark hover:bg-primary-deep active:scale-[0.98] shadow-lg shadow-primary-dark/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider h-11"
          >
            <Play className="w-4 h-4 fill-white" />
            Initiate Campaign Scrape
          </Button>

          {/* Diagnostics Button */}
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              disabled={diagLoading || isCrawlLoading}
              onClick={runDiagnostics}
              className="w-full h-10 border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-zinc-900/50 cursor-pointer"
            >
              <Activity className={cn("w-4 h-4 text-emerald-400 animate-pulse", diagLoading && "animate-spin")} />
              {diagLoading ? "Diagnosing catalog indices..." : "Run Pre-flight Diagnostics"}
            </Button>
          </div>

          {diagData && (
            <div className="mt-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md shadow-inner text-zinc-300 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Pre-flight Diagnostics Summary</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 font-semibold border border-zinc-800">
                  {diagData.country} STOREFRONT
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-3.5">
                <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
                  <div className="text-[10px] text-zinc-500 font-medium">Estimated Unique Products</div>
                  <div className="text-lg font-bold text-zinc-100 font-mono mt-0.5">
                    {diagData.estimated_unique_products.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-emerald-500 font-medium mt-0.5">Final scraped dataset size</div>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
                  <div className="text-[10px] text-zinc-500 font-medium">Multi-Category Sum</div>
                  <div className="text-lg font-bold text-zinc-100 font-mono mt-0.5">
                    {diagData.total_category_sum.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-amber-500 font-medium mt-0.5">Includes category overlaps</div>
                </div>
              </div>

              <div className="mb-3.5">
                <div className="flex justify-between items-center text-[10px] mb-1">
                  <span className="text-zinc-500">Multi-Category Product Overlap Rate</span>
                  <span className="font-semibold text-amber-400 font-mono">{diagData.overlap_percentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500" 
                    style={{ width: `${diagData.overlap_percentage}%` }}
                  />
                </div>
                <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">
                  Overlap rate explains why fetching the full catalog returns {diagData.estimated_unique_products.toLocaleString()} unique items rather than the category sum of {diagData.total_category_sum.toLocaleString()} (deduplicated by product slug).
                </p>
              </div>

              <div>
                <span className="text-[9px] text-zinc-400 font-bold block mb-1.5 uppercase tracking-wide">Category Distribution Breakdown</span>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {diagData.categories.map((cat: any) => (
                    <div key={cat.slug} className="flex justify-between items-center text-[10px] bg-zinc-900/30 px-2.5 py-1.5 rounded-md border border-zinc-900">
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-300">{cat.name_en}</span>
                        <span className="text-[8px] text-zinc-500 font-mono">{cat.slug}</span>
                      </div>
                      <span className="font-bold text-emerald-400 font-mono">{cat.count.toLocaleString()} items</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Stream ANSI logs terminal & widgets */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        {/* Visual Aggregation Gauges */}
        {(() => {
          const activeJob = jobs.find((j) => j.status === "running" || j.status === "pending");
          const latestJob = showParamsForm ? null : (jobs.find((j) => j.job_id === activeJobId) || activeJob || jobs[0]);
          const isRunning = latestJob?.status === "running" || latestJob?.status === "pending";

          const processedCats = progressMetrics?.processed_categories ?? latestJob?.progress?.processed_categories ?? 0;
          const totalCats = progressMetrics?.total_categories ?? latestJob?.progress?.total_categories ?? 0;
          const productsScraped = progressMetrics?.products_found ?? latestJob?.progress?.products_found ?? 0;
          const currentAction = isRunning
            ? (progressMetrics?.current_action ?? latestJob?.progress?.current_action ?? "Scraping...")
            : (latestJob?.status === "completed"
              ? "Campaign finished successfully."
              : latestJob?.status === "stopped"
                ? "Campaign stopped."
                : latestJob?.status === "failed"
                  ? "Campaign failed."
                  : "Waiting for campaign launch...");

          const isBrandOrProduct = latestJob?.target === "brands" || latestJob?.target === "products";
          const campaignTargetLabel = latestJob?.target
            ? latestJob.target.toUpperCase().replace("-", " ")
            : "CAMPAIGN TARGET";

          return (
            <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2", latestJob ? "xl:grid-cols-4" : "xl:grid-cols-2")}>
              {/* Card 1: Target Scraped Progress */}
              {latestJob && (
                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/80 shadow-md flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                        {campaignTargetLabel} SCRAPED
                      </span>

                      <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${latestJob.status === "completed"
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        : latestJob.status === "running"
                          ? "bg-sky-500/10 border border-sky-500/20 text-sky-400 animate-pulse"
                          : latestJob.status === "pending"
                            ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                            : latestJob.status === "stopped"
                              ? "bg-zinc-500/10 border border-zinc-500/20 text-zinc-400"
                              : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                        }`}>
                        {latestJob.status}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-primary">
                        {isBrandOrProduct ? productsScraped : processedCats}
                      </span>
                      <span className="text-xs text-zinc-500 font-medium">
                        {isBrandOrProduct ? (
                          latestJob.target === "products" ? "products found" : "brands found"
                        ) : (
                          `/ ${totalCats} categories`
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-zinc-950 h-1.5 rounded-full mt-3.5 overflow-hidden">
                    <div
                      className="bg-primary-dark h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${isBrandOrProduct
                          ? (productsScraped > 0 ? 100 : 0)
                          : (totalCats ? (processedCats / totalCats) * 100 : 0)}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Card 2: Execution Timing (Active Timer) */}
              {latestJob && (
                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/80 shadow-md flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">
                      EXECUTION ELAPSED TIME
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <ActiveCrawlTimer job={latestJob} />
                    </div>
                  </div>
                  <span className="text-[9px] text-zinc-500 mt-3.5 block font-mono">
                    Started: {new Date(latestJob.started_at || latestJob.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}

              {/* Card 3: Status & Current Activity */}
              <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/80 shadow-md flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">
                    CURRENT STATUS TELEMETRY
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${latestJob?.status === "completed"
                      ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
                      : latestJob?.status === "running"
                        ? "bg-sky-500 animate-ping"
                        : latestJob?.status === "pending"
                          ? "bg-amber-500 animate-pulse"
                          : latestJob?.status === "stopped"
                            ? "bg-zinc-500"
                            : "bg-rose-500 shadow-lg shadow-rose-500/30"
                      }`} />
                    <span className="text-xs font-bold text-zinc-300 font-mono capitalize">
                      {latestJob?.status || "Idle / Offline"}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] text-zinc-500 mt-3.5 block truncate font-mono" title={currentAction}>
                  {currentAction}
                </span>
              </div>

              {/* Card 4: Actions Control */}
              <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/80 shadow-md flex flex-col justify-between">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Actions control</span>
                {latestJob && (latestJob.status === "running" || latestJob.status === "pending") ? (
                  <button
                    onClick={() => handleStopCampaign(latestJob.job_id)}
                    className="mt-2 py-1.5 px-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold hover:bg-rose-500 hover:text-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Kill Campaign
                  </button>
                ) : (
                  <span className="text-xs text-zinc-500 italic mt-2 block">No campaign running</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Telemetry logs terminal */}
        <div className="flex-1 min-h-[380px] p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-bold text-zinc-400 font-mono">Live Telemetry Terminal</span>
            </div>
            {activeJobId && (() => {
              const activeJob = jobs.find((j) => j.status === "running" || j.status === "pending");
              const latestJobForTerminal = activeJob || jobs.find((j) => j.job_id === activeJobId);
              const isRunningForTerminal = latestJobForTerminal?.status === "running" || latestJobForTerminal?.status === "pending";
              return (
                <span className={cn(
                  "flex items-center gap-1.5 text-[9px] uppercase tracking-wider py-0.5 px-2 rounded-full font-bold transition-all duration-300",
                  isRunningForTerminal
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800 border border-zinc-700 text-zinc-400"
                )}>
                  {isRunningForTerminal && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />}
                  {isRunningForTerminal ? "Live Pipe" : "Pipe Offline"}
                </span>
              );
            })()}
          </div>

          <div ref={terminalRef} className="flex-1 overflow-y-auto max-h-[360px] font-mono text-[11px] leading-5 space-y-1 text-zinc-300 pr-2">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-600 italic">
                Terminal ready. Initiate a scraping campaign parameters to stream live logs pipeline here.
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap select-all">
                  <span className="text-zinc-600 mr-2">[{log.timestamp.slice(11, 19)}]</span>
                  <span dangerouslySetInnerHTML={{ __html: parseAnsiToHtml(log.line) }} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
