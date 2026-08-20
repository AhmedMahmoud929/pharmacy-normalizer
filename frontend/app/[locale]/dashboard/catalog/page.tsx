"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
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
import { authEventSourceUrl } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/use-toast";
import { FeatureBadge } from "@/components/shared/FeatureBadge";

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
  const t = useTranslations("Catalog");
  const tDash = useTranslations("Dashboard");
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

      const es = new EventSource(authEventSourceUrl(`/api/catalog/pipeline/jobs/${jobId}/stream`));
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
              message: data.message,
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
    <div className="w-full min-w-0 space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <FeatureBadge icon={Database} label={tDash("badge_catalog")} />
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-start">
              {t("title")}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-start">
              {t("subtitle")}
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
            className="shrink-0 border-border text-foreground hover:bg-muted self-start md:self-auto"
          >
            <RefreshCw className={cn("w-4 h-4 me-2", statsLoading && "animate-spin")} />
            {t("btn_refresh")}
          </Button>
        </div>

        {/* Stats Grid */}
        <StatCardGrid>
          <StatCard
            label={t("stat_live_products")}
            value={stats?.live_products ?? health?.live_products}
            icon={Package}
            iconClassName="text-primary"
          />
          <StatCard
            label={t("stat_normalized")}
            value={stats?.normalized_products}
            icon={CheckCircle2}
            iconClassName="text-emerald-400"
          />
          <StatCard
            label={t("stat_with_barcodes")}
            value={stats?.with_barcodes}
            icon={Barcode}
            iconClassName="text-sky-400"
          />
          <StatCard
            label={t("stat_source")}
            value={stats?.source ?? health?.catalog_source}
            icon={Server}
            iconClassName="text-amber-400"
            valueClassName="text-lg"
          />
        </StatCardGrid>

        {stats?.last_promoted_at && (
          <p className="text-xs text-zinc-500 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {t("last_promoted", { date: formatDate(stats.last_promoted_at) })}
          </p>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 p-5 md:p-6 rounded-2xl bg-card border border-border space-y-4 min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-lg text-start">{t("refresh_chefaa_title")}</h2>
                <p className="text-xs text-zinc-500 text-start break-words">{t("refresh_chefaa_sub")}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-start">
              {t("refresh_chefaa_desc")}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => startPipeline([...fullRefreshSteps], "Full Refresh")}
                disabled={isStarting}
                className="flex-1 bg-primary hover:bg-primary/90 font-bold"
              >
                {isStarting ? (
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 me-2 rtl:rotate-180" />
                )}
                {t("btn_start_refresh")}
              </Button>
              <div className="flex flex-1 gap-2 min-w-0">
                <input
                  type="number"
                  min={1}
                  max={50000}
                  value={testProductLimit}
                  onChange={(e) => setTestProductLimit(e.target.value)}
                  disabled={isStarting}
                  className="w-24 shrink-0 px-3 rounded-lg bg-background border border-input text-sm font-mono text-foreground focus:outline-none focus:border-primary"
                  aria-label="Test product limit"
                />
                <Button
                  variant="outline"
                  onClick={handleTestPipeline}
                  disabled={isStarting}
                  className="flex-1 min-w-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-semibold"
                >
                  {t("btn_test_pipeline")}
                </Button>
              </div>
            </div>
            <p className="text-xs text-zinc-500 text-start">
              {t("test_pipeline_note")}
            </p>
          </div>

          <div className="lg:col-span-2 p-5 md:p-6 rounded-2xl bg-card border border-border space-y-4 flex flex-col min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-muted flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-lg text-start">{t("quick_actions")}</h2>
                <p className="text-xs text-zinc-500 text-start">{t("quick_actions_sub")}</p>
              </div>
            </div>
            <div className="grid gap-2 flex-1">
              <Button
                variant="outline"
                onClick={() =>
                  startPipeline(
                    ["sync_staging", "normalize", "seed_mappings", "promote", "reload_index"],
                    "Re-normalize Catalog"
                  )
                }
                disabled={isStarting}
                className="w-full h-auto min-h-11 border-border text-foreground justify-start gap-2 px-3 py-2.5"
              >
                <span className="truncate flex-1 text-start">{t("btn_normalize_existing")}</span>
                <ActionInfoTip text={t("note_renormalize")} />
                <ArrowRight className="w-4 h-4 shrink-0 rtl:rotate-180" />
              </Button>
              <Button
                variant="outline"
                onClick={handleReloadIndex}
                disabled={isReloading}
                className="w-full h-auto min-h-11 border-border text-foreground justify-start gap-2 px-3 py-2.5"
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  {isReloading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                  <span className="truncate text-start">{t("btn_reload_index")}</span>
                </span>
                {!isReloading && <ActionInfoTip text={t("note_reloadIndex")} />}
                <ArrowRight className="w-4 h-4 shrink-0 rtl:rotate-180" />
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
                    {t("pipeline_progress")}
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
<Loader2 className="w-4 h-4 me-2 animate-spin" />
                        ) : (
                        <X className="w-4 h-4 me-2" />
                      )}
                      {t("btn_cancel")}
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
                    {activeJob.status === "awaiting_promotion" ? t("waiting_confirm") : activeJob.status}
                  </span>
                </div>
              </div>

              {/* Live crawl telemetry */}
              {(isCrawlRunning || (crawlStep?.products_found != null && crawlStep.products_found > 0)) && (
                <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Products Found"
                    value={crawlStep?.products_found ?? 0}
                    icon={Package}
                    iconClassName="text-primary"
                    valueClassName="text-primary"
                  />
                  {(crawlStep?.total_categories ?? 0) > 0 && (
                    <StatCard
                      label="Categories"
                      value={`${crawlStep?.processed_categories ?? 0}/${crawlStep?.total_categories}`}
                      icon={Database}
                      iconClassName="text-sky-400"
                      valueClassName="text-sky-400"
                    />
                  )}
                  {crawlStep?.total != null && crawlStep.total > 0 && (
                    <StatCard
                      label="Catalog Index"
                      value={`~${crawlStep.total.toLocaleString()}`}
                      icon={Server}
                      iconClassName="text-amber-400"
                      valueClassName="text-amber-400"
                    />
                  )}
                  <div className="p-5 rounded-2xl bg-card border border-border backdrop-blur-sm col-span-2 md:col-span-1">
                    <Clock className="w-5 h-5 mb-3 text-muted-foreground" />
                    <p className="text-xs text-foreground/80 line-clamp-2">
                      {crawlStep?.message || "Fetching from Meilisearch…"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                      Current Action
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
                              {t("step_" + step, { defaultValue: STEP_LABELS[step] ?? step })}
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
                          {stepData?.message && status === "running" && (
                            <p className="text-xs text-muted-foreground mt-1">{stepData.message}</p>
                          )}
                        </div>
                      </div>

                      {step === "promote" &&
                        activeJob.status === "awaiting_promotion" &&
                        promotePreview && (
                          <div className="ms-9 mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
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
                                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 me-2" />
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
                    "w-full flex items-center justify-between p-4 rounded-xl border text-start transition-all",
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
                        {t("step_" + job.current_step, { defaultValue: STEP_LABELS[job.current_step] ?? job.current_step })}
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
  );
}
