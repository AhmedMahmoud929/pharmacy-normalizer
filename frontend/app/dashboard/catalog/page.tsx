"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Database,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Server,
  ArrowRight,
  History,
  RotateCcw,
  Package,
  Barcode,
  Clock,
  X,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, API_URL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface CatalogStats {
  live_products: number;
  staging_products: number;
  normalized_products: number;
  with_codes: number;
  with_barcodes: number;
  last_promoted_at: string | null;
  source: string;
}

interface StepProgress {
  status: string;
  message?: string;
  processed?: number;
  total?: number;
  products_found?: number;
  processed_categories?: number;
  total_categories?: number;
  started_at?: string;
  finished_at?: string;
}

interface PipelineJob {
  job_id: string;
  status: "pending" | "running" | "awaiting_promotion" | "completed" | "failed" | "cancelled";
  current_step: string | null;
  steps: string[];
  progress: {
    steps?: Record<string, StepProgress>;
  };
  error_msg: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
}

const STEP_LABELS: Record<string, string> = {
  crawl: "Fetch from Meilisearch API",
  sync_staging: "Copy Live to Staging",
  import: "Import to Staging",
  normalize: "Normalize Products",
  seed_mappings: "Seed Brand Mappings",
  promote: "Promote to Live Catalog",
  reload_index: "Reload Matcher Index",
};

const STEP_ORDER = [
  "crawl",
  "sync_staging",
  "import",
  "normalize",
  "seed_mappings",
  "promote",
  "reload_index",
];

function stepStatusIcon(status: string) {
  if (status === "completed")
    return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
  if (status === "running")
    return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
  if (status === "failed")
    return <AlertCircle className="w-5 h-5 text-rose-400" />;
  return <div className="w-5 h-5 rounded-full border-2 border-zinc-700" />;
}

function ActionInfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const anchorRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));

    const spaceAbove = rect.top - 12;
    const placeAbove = spaceAbove >= 96;

    setStyle({
      position: "fixed",
      left,
      width,
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      transform: placeAbove ? "translateY(-100%)" : undefined,
      zIndex: 9999,
    });
  }, []);

  const show = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex shrink-0"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => e.stopPropagation()}
        tabIndex={0}
        role="img"
        aria-label="When to use this action"
      >
        <Info className="w-4 h-4 text-zinc-500 hover:text-zinc-300 cursor-help" />
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={style}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-xs leading-relaxed text-zinc-300 shadow-xl pointer-events-none"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}

const QUICK_ACTION_NOTES = {
  renormalize:
    "Use when the live catalog is already up to date but normalized names or brand mappings need to be rebuilt — e.g. after changing normalizer rules. Skips Meilisearch fetch; copies live → staging, re-normalizes, then promotes.",
  reloadIndex:
    "Use when SQLite already has the correct catalog but search/match still returns old data — e.g. after a manual DB edit, backend restart, or if promote finished but the matcher feels stale. Refreshes the in-memory index only; no crawl or promote.",
} as const;

export default function CatalogSeederPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [health, setHealth] = useState<{
    database_loaded?: boolean;
    live_products?: number;
    catalog_source?: string;
  } | null>(null);
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<PipelineJob | null>(null);
  const [testProductLimit, setTestProductLimit] = useState("5000");
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isConfirmingPromote, setIsConfirmingPromote] = useState(false);
  const [promotePreview, setPromotePreview] = useState<{
    staging_products: number;
    live_products: number;
  } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const mergeStepProgress = useCallback((step: string, patch: Partial<StepProgress>) => {
    setActiveJob((prev) => {
      if (!prev) return prev;
      const steps = { ...(prev.progress?.steps || {}) };
      steps[step] = { ...(steps[step] || { status: "running" }), ...patch };
      return { ...prev, progress: { ...prev.progress, steps } };
    });
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch(`${API_URL}/api/catalog/stats`),
        fetch(`${API_URL}/health`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
    } catch {
      toast({
        title: "Connection Error",
        description: "Could not reach the catalog API.",
        type: "error",
      });
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/catalog/pipeline/jobs?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch {
      /* silent */
    }
  }, []);

  const fetchJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/catalog/pipeline/jobs/${jobId}`);
      if (!res.ok) return;
      const job: PipelineJob = await res.json();
      setActiveJob(job);
      if (job.status === "cancelled") {
        eventSourceRef.current?.close();
        setIsStarting(false);
        setIsCancelling(false);
      } else if (job.status === "completed" || job.status === "failed") {
        setIsStarting(false);
        setIsCancelling(false);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchJobs();
  }, [fetchStats, fetchJobs]);

  const connectStream = useCallback(
    (jobId: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(`${API_URL}/api/catalog/pipeline/jobs/${jobId}/stream`);
      eventSourceRef.current = es;

      es.addEventListener("step_start", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data.step) mergeStepProgress(data.step, { status: "running" });
        } catch {
          /* ignore */
        }
        fetchJob(jobId);
      });

      es.addEventListener("step_progress", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data.step) {
            mergeStepProgress(data.step, {
              status: "running",
              processed: data.processed,
              total: data.total,
              products_found: data.products_found,
              processed_categories: data.processed_categories,
              total_categories: data.total_categories,
            });
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("step_complete", () => fetchJob(jobId));

      es.addEventListener("promote_confirmation_required", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          setPromotePreview({
            staging_products: data.staging_products ?? 0,
            live_products: data.live_products ?? 0,
          });
          mergeStepProgress("promote", {
            status: "pending",
            message: "Waiting for your confirmation",
            processed: data.staging_products,
            total: data.staging_products,
          });
        } catch {
          /* ignore */
        }
        fetchJob(jobId);
      });

      es.addEventListener("pipeline_cancelled", async () => {
        await fetchJob(jobId);
        await fetchJobs();
        toast({ title: "Pipeline Cancelled", description: "The pipeline was stopped." });
        es.close();
        setIsStarting(false);
        setIsCancelling(false);
        setPromotePreview(null);
      });

      es.addEventListener("pipeline_complete", async () => {
        await fetchJob(jobId);
        await fetchStats();
        await fetchJobs();
        toast({ title: "Pipeline Complete", description: "Catalog has been refreshed successfully." });
        es.close();
        setIsStarting(false);
        setIsCancelling(false);
        setPromotePreview(null);
      });

      es.addEventListener("pipeline_error", async (e) => {
        await fetchJob(jobId);
        await fetchJobs();
        let msg = "Pipeline failed.";
        try {
          const data = JSON.parse((e as MessageEvent).data);
          msg = data.message || msg;
        } catch {
          /* ignore */
        }
        toast({ title: "Pipeline Failed", description: msg, type: "error" });
        es.close();
        setIsStarting(false);
        setIsCancelling(false);
        setPromotePreview(null);
      });

      es.onerror = () => {
        fetchJob(jobId);
      };
    },
    [fetchJob, fetchJobs, fetchStats, mergeStepProgress, toast]
  );

  useEffect(() => {
    if (!activeJob || !["running", "pending", "awaiting_promotion"].includes(activeJob.status)) return;
    const intervalMs = isCancelling ? 1000 : activeJob.status === "awaiting_promotion" ? 2000 : 3000;
    const interval = setInterval(() => fetchJob(activeJob.job_id), intervalMs);
    return () => clearInterval(interval);
  }, [activeJob, fetchJob, isCancelling]);

  useEffect(() => {
    if (activeJob?.status === "awaiting_promotion") {
      const promoteStep = activeJob.progress?.steps?.promote;
      setPromotePreview((prev) => ({
        staging_products: promoteStep?.processed ?? prev?.staging_products ?? stats?.staging_products ?? 0,
        live_products: prev?.live_products ?? stats?.live_products ?? 0,
      }));
    } else if (!activeJob || activeJob.status === "completed" || activeJob.status === "cancelled") {
      setPromotePreview(null);
    }
  }, [activeJob, stats?.live_products, stats?.staging_products]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const startPipeline = async (
    steps: string[],
    label: string,
    crawlOptions?: { max_products?: number }
  ) => {
    setIsStarting(true);
    try {
      const res = await fetch(`${API_URL}/api/catalog/pipeline/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps,
          background: true,
          ...(crawlOptions ? { crawl_options: crawlOptions } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to start pipeline");
      }
      const data = await res.json();
      setActiveJobId(data.job_id);
      toast({ title: "Pipeline Started", description: `${label} — job ${data.job_id.slice(0, 8)}…` });
      await fetchJob(data.job_id);
      connectStream(data.job_id);
      await fetchJobs();
    } catch (err: unknown) {
      toast({
        title: "Start Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
      setIsStarting(false);
    }
  };

  const handleConfirmPromote = async () => {
    if (!activeJob?.job_id) return;
    setIsConfirmingPromote(true);
    try {
      const res = await fetch(
        `${API_URL}/api/catalog/pipeline/jobs/${activeJob.job_id}/confirm-promote`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to confirm promotion");
      }
      setPromotePreview(null);
      await fetchJob(activeJob.job_id);
      toast({
        title: "Promotion confirmed",
        description: "Replacing the live catalog and reloading the matcher index…",
      });
    } catch (err: unknown) {
      toast({
        title: "Confirmation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    } finally {
      setIsConfirmingPromote(false);
    }
  };

  const handleCancelPipeline = async () => {
    if (!activeJob?.job_id) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`${API_URL}/api/catalog/pipeline/jobs/${activeJob.job_id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to cancel pipeline");
      }
      await fetchJob(activeJob.job_id);
      await fetchJobs();
      eventSourceRef.current?.close();
      setIsStarting(false);
      setIsCancelling(false);
      toast({
        title: "Cancelled",
        description: "Pipeline stopped.",
      });
    } catch (err: unknown) {
      setIsCancelling(false);
      toast({
        title: "Cancel Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    }
  };

  const handleReloadIndex = async () => {
    setIsReloading(true);
    try {
      const res = await fetch(`${API_URL}/api/catalog/reload`, { method: "POST" });
      if (!res.ok) throw new Error("Reload failed");
      await fetchStats();
      toast({ title: "Index Reloaded", description: "Matcher index refreshed from SQLite." });
    } catch (err: unknown) {
      toast({
        title: "Reload Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    } finally {
      setIsReloading(false);
    }
  };

  const fullRefreshSteps = [
    "crawl",
    "import",
    "normalize",
    "seed_mappings",
    "promote",
    "reload_index",
  ] as const;

  const handleTestPipeline = () => {
    const limit = parseInt(testProductLimit, 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      toast({
        title: "Invalid limit",
        description: "Enter a positive number of products.",
        type: "error",
      });
      return;
    }
    startPipeline([...fullRefreshSteps], `Test Run (${limit.toLocaleString()} products)`, {
      max_products: limit,
    });
  };

  const displaySteps = activeJob?.steps?.length
    ? STEP_ORDER.filter((s) => activeJob.steps.includes(s))
    : [];

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
  };

  const crawlStep = activeJob?.progress?.steps?.crawl;
  const isCrawlRunning = crawlStep?.status === "running";

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-4">
              <Database className="w-3 h-3" />
              SQLite Catalog
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Catalog Seeder
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Populate and refresh the master product database from Chefaa's Meilisearch API —
              normalize, seed mappings, and reload the matcher index. No web scraping.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatsLoading(true);
              fetchStats();
              fetchJobs();
            }}
            className="border-border text-foreground hover:bg-muted"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", statsLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Live Products",
              value: stats?.live_products ?? health?.live_products ?? "—",
              icon: Package,
              color: "text-primary",
            },
            {
              label: "Normalized",
              value: stats?.normalized_products ?? "—",
              icon: CheckCircle2,
              color: "text-emerald-400",
            },
            {
              label: "With Barcodes",
              value: stats?.with_barcodes ?? "—",
              icon: Barcode,
              color: "text-sky-400",
            },
            {
              label: "Source",
              value: stats?.source ?? health?.catalog_source ?? "—",
              icon: Server,
              color: "text-amber-400",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="p-5 rounded-2xl bg-card border border-border backdrop-blur-sm"
            >
              <card.icon className={cn("w-5 h-5 mb-3", card.color)} />
              <p className="text-2xl font-bold font-mono">
                {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
              </p>
              <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-semibold">
                {card.label}
              </p>
            </div>
          ))}
        </div>

        {stats?.last_promoted_at && (
          <p className="text-xs text-zinc-500 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Last promoted: {formatDate(stats.last_promoted_at)}
          </p>
        )}

        {/* Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Full Refresh from Chefaa</h2>
                <p className="text-xs text-zinc-500">Meilisearch API → Import → Normalize → Seed → Promote → Reload</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Fetches the full Egyptian catalog via Chefaa&apos;s Meilisearch API (~30K products in minutes),
              normalizes all product names, seeds brand mappings, and activates the new catalog.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => startPipeline([...fullRefreshSteps], "Full Refresh")}
                disabled={isStarting}
                className="flex-1 bg-primary hover:bg-primary/90 font-bold"
              >
                {isStarting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Start Full Refresh
              </Button>
              <div className="flex flex-1 gap-2">
                <input
                  type="number"
                  min={1}
                  max={50000}
                  value={testProductLimit}
                  onChange={(e) => setTestProductLimit(e.target.value)}
                  disabled={isStarting}
                  className="w-24 px-3 rounded-lg bg-background border border-input text-sm font-mono text-foreground focus:outline-none focus:border-primary"
                  aria-label="Test product limit"
                />
                <Button
                  variant="outline"
                  onClick={handleTestPipeline}
                  disabled={isStarting}
                  className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-semibold"
                >
                  Test Pipeline
                </Button>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Test Pipeline runs the same steps but fetches only the specified number of products from Meilisearch.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border space-y-4 flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Quick Actions</h2>
                <p className="text-xs text-zinc-500">Without re-crawling Chefaa</p>
              </div>
            </div>
            <div className="space-y-2 grid gap-2 h-full">
              <Button
                variant="outline"
                onClick={() =>
                  startPipeline(
                    ["sync_staging", "normalize", "seed_mappings", "promote", "reload_index"],
                    "Re-normalize Catalog"
                  )
                }
                disabled={isStarting}
                className="w-full !h-full border-border text-foreground justify-between gap-2"
              >
                <span className="truncate flex-1 text-left">Re-normalize Existing Catalog</span>
                <ActionInfoTip text={QUICK_ACTION_NOTES.renormalize} />
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
              <Button
                variant="outline"
                onClick={handleReloadIndex}
                disabled={isReloading}
                className="w-full !h-full border-border text-foreground justify-between gap-2"
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  {isReloading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                  <span className="truncate text-left">Reload Matcher Index</span>
                </span>
                {!isReloading && <ActionInfoTip text={QUICK_ACTION_NOTES.reloadIndex} />}
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
            </div>
          </div>
        </div>

        {/* Active Pipeline Progress */}
        <AnimatePresence>
          {activeJob && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="p-6 rounded-2xl bg-card border border-border"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-lg flex items-center gap-2">
                    {activeJob.status === "running" && (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    )}
                    Pipeline Progress
                  </h2>
                  <p className="text-xs text-zinc-500 font-mono mt-1">{activeJob.job_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(activeJob.status === "running" || activeJob.status === "awaiting_promotion") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelPipeline}
                      disabled={isCancelling || isConfirmingPromote}
                      className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                    >
                      {isCancelling ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <X className="w-4 h-4 mr-2" />
                      )}
                      Cancel
                    </Button>
                  )}
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                      activeJob.status === "completed" && "bg-emerald-500/10 text-emerald-400",
                      activeJob.status === "running" && "bg-primary/10 text-primary",
                      activeJob.status === "awaiting_promotion" && "bg-amber-500/10 text-amber-400",
                      activeJob.status === "failed" && "bg-rose-500/10 text-rose-400",
                      activeJob.status === "cancelled" && "bg-amber-500/10 text-amber-400",
                      activeJob.status === "pending" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {activeJob.status === "awaiting_promotion" ? "awaiting confirm" : activeJob.status}
                  </span>
                </div>
              </div>

              {/* Live crawl telemetry */}
              {(isCrawlRunning || (crawlStep?.products_found != null && crawlStep.products_found > 0)) && (
                <div className="mb-6 p-4 rounded-xl bg-muted border border-border grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Products Found</p>
                    <p className="text-2xl font-bold font-mono text-primary mt-1">
                      {(crawlStep?.products_found ?? 0).toLocaleString()}
                    </p>
                  </div>
                  {(crawlStep?.total_categories ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Categories</p>
                      <p className="text-2xl font-bold font-mono text-sky-400 mt-1">
                        {crawlStep?.processed_categories ?? 0}/{crawlStep?.total_categories}
                      </p>
                    </div>
                  )}
                  {crawlStep?.total != null && crawlStep.total > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Catalog Index</p>
                      <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                        ~{crawlStep.total.toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Current Action</p>
                    <p className="text-xs text-foreground/80 mt-1 line-clamp-2">
                      {crawlStep?.message || "Fetching from Meilisearch…"}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {displaySteps.map((step, idx) => {
                  const stepData = activeJob.progress?.steps?.[step];
                  const status = stepData?.status || "pending";
                  const isLast = idx === displaySteps.length - 1;

                  return (
                    <div key={step}>
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          {stepStatusIcon(status)}
                          {!isLast && (
                            <div
                              className={cn(
                                "w-0.5 flex-1 my-1 min-h-[24px]",
                                status === "completed" ? "bg-emerald-500/40" : "bg-border"
                              )}
                            />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between">
                            <p
                              className={cn(
                                "font-semibold text-sm",
                                status === "running" && "text-primary",
                                status === "completed" && "text-emerald-400",
                                status === "pending" && "text-zinc-500"
                              )}
                            >
                              {STEP_LABELS[step] || step}
                            </p>
                            {step === "crawl" && stepData?.products_found != null ? (
                              <span className="text-xs font-mono text-zinc-500">
                                {stepData.products_found.toLocaleString()} products
                              </span>
                            ) : stepData?.processed != null && stepData?.total != null ? (
                              <span className="text-xs font-mono text-zinc-500">
                                {stepData.processed.toLocaleString()} / {stepData.total.toLocaleString()}
                              </span>
                            ) : stepData?.processed != null ? (
                              <span className="text-xs font-mono text-zinc-500">
                                {stepData.processed.toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {step === "promote" &&
                        activeJob.status === "awaiting_promotion" &&
                        promotePreview && (
                          <div className="ml-9 mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                            <p className="font-semibold text-amber-400 text-sm">
                              Confirm promote to live catalog
                            </p>
                            <p className="text-xs text-foreground/80 mt-1">
                              Replace the current live catalog (
                              {promotePreview.live_products.toLocaleString()} products) with the staged
                              catalog ({promotePreview.staging_products.toLocaleString()} products).
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                              <Button
                                size="sm"
                                onClick={handleConfirmPromote}
                                disabled={isConfirmingPromote || isCancelling}
                                className="bg-amber-500 hover:bg-amber-500/90 text-zinc-950 font-bold"
                              >
                                {isConfirmingPromote ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                )}
                                Promote to Live
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelPipeline}
                                disabled={isConfirmingPromote || isCancelling}
                                className="border-border text-foreground"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>

              {activeJob.error_msg && (
                <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                  {activeJob.error_msg}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Job History */}
        <div className="p-6 rounded-2xl bg-card border border-border">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-muted-foreground" />
            Pipeline History
          </h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">No pipeline runs yet.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <button
                  key={job.job_id}
                  onClick={() => {
                    setActiveJobId(job.job_id);
                    setActiveJob(job);
                    if (job.status === "running" || job.status === "awaiting_promotion") connectStream(job.job_id);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all",
                    activeJobId === job.job_id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-muted/50"
                  )}
                >
                  <div>
                    <p className="text-sm font-mono text-muted-foreground">{job.job_id.slice(0, 8)}…</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{formatDate(job.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {job.current_step && (
                      <span className="text-xs text-zinc-500 hidden sm:block">
                        {STEP_LABELS[job.current_step] || job.current_step}
                      </span>
                    )}
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-bold uppercase",
                        job.status === "completed" && "bg-emerald-500/10 text-emerald-400",
                        job.status === "running" && "bg-primary/10 text-primary",
                        job.status === "awaiting_promotion" && "bg-amber-500/10 text-amber-400",
                        job.status === "failed" && "bg-rose-500/10 text-rose-400",
                        job.status === "cancelled" && "bg-amber-500/10 text-amber-400",
                        job.status === "pending" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {job.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
