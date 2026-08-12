"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Images,
  Download,
  Loader2,
  Search,
  Package,
  Tag,
  HardDrive,
  CloudOff,
  StopCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, API_URL } from "@/lib/utils";
import { FeatureBadge } from "@/components/shared/FeatureBadge";
import { StatCard } from "@/components/ui/stat-card";
import { cardSurfaceClass } from "@/components/ui/stat-card";

type CategoryFilter = "all" | "products" | "brands";

interface GalleryStats {
  local_product_images: number;
  local_brand_images: number;
  local_total: number;
  catalog_products_with_image: number;
  catalog_products_local: number;
  catalog_products_missing: number;
  catalog_brand_images: number;
  catalog_brands_local: number;
  catalog_brands_missing: number;
}

interface GalleryImage {
  filename: string;
  category: string;
  size_bytes: number;
  modified_at: string;
  url: string;
  label: string;
  product_id?: string;
  cdn_url?: string;
}

interface FetchJob {
  job_id?: string;
  status: string;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  remaining?: number;
  progress_pct: number;
  error?: string;
  message?: string;
  recent_logs?: string[];
}

const ACTIVE_FETCH_STATUSES = new Set(["running", "stopping"]);
const FINISHED_FETCH_STATUSES = new Set(["completed", "stopped", "failed"]);

function FetchResultSummary({
  job,
  onDismiss,
  t,
}: {
  job: FetchJob;
  onDismiss: () => void;
  t: ReturnType<typeof useTranslations<"Gallery">>;
}) {
  const [showLogs, setShowLogs] = useState(false);

  const isSuccess = job.status === "completed";
  const isStopped = job.status === "stopped";
  const isFailed = job.status === "failed";

  const Icon = isSuccess ? CheckCircle2 : isStopped ? AlertTriangle : XCircle;
  const accent = isSuccess
    ? "text-green-600 dark:text-green-400"
    : isStopped
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";
  const surface = isSuccess
    ? "border-green-500/20 bg-green-500/5"
    : isStopped
      ? "border-amber-500/20 bg-amber-500/5"
      : "border-destructive/20 bg-destructive/5";

  const title = isSuccess
    ? t("success_title")
    : isStopped
      ? t("stopped_title")
      : t("failed_title");

  const subtitle =
    job.message ||
    (isSuccess
      ? t("success_desc")
      : isStopped
        ? t("stopped_desc")
        : job.error || t("failed_desc"));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border p-4 sm:p-5 space-y-4", surface)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Icon className={cn("w-6 h-6 shrink-0 mt-0.5", accent)} />
          <div className="min-w-0 space-y-1">
            <p className={cn("font-semibold text-base", accent)}>{title}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label={t("dismiss")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("succeeded"), value: job.succeeded, tone: "text-foreground" },
          { label: t("skipped"), value: job.skipped, tone: "text-muted-foreground" },
          { label: t("failed"), value: job.failed, tone: job.failed ? "text-destructive" : "text-muted-foreground" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-center"
          >
            <p className={cn("text-xl font-bold tabular-nums", item.tone)}>{item.value}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {isStopped && job.remaining ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">{t("stopped_hint")}</p>
      ) : null}

      {job.recent_logs && job.recent_logs.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showLogs && "rotate-180")} />
            {showLogs ? t("hide_logs") : t("view_logs")}
          </button>
          {showLogs ? (
            <div className="max-h-32 overflow-y-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] text-muted-foreground space-y-0.5">
              {job.recent_logs.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}

function FetchProgressPanel({ job, t }: { job: FetchJob; t: ReturnType<typeof useTranslations<"Gallery">> }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <div className="flex items-center justify-between text-sm gap-4">
        <span className="inline-flex items-center gap-2 font-medium text-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          {job.status === "stopping" ? t("stopping") : t("downloading")}
        </span>
        <span className="text-muted-foreground tabular-nums shrink-0">
          {job.completed} / {job.total}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            job.status === "stopping" ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${job.progress_pct || 0}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{job.succeeded} {t("succeeded")}</span>
        <span>{job.skipped} {t("skipped")}</span>
        <span>{job.failed} {t("failed")}</span>
      </div>
      {job.recent_logs && job.recent_logs.length > 0 ? (
        <div className="max-h-28 overflow-y-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] text-muted-foreground space-y-0.5">
          {job.recent_logs.slice(-8).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

const PAGE_SIZE = 48;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GalleryPage() {
  const t = useTranslations("Gallery");
  const tDash = useTranslations("Dashboard");

  const [stats, setStats] = useState<GalleryStats | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchJob, setFetchJob] = useState<FetchJob | null>(null);
  const [fetching, setFetching] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/gallery/stats`);
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/gallery/images?category=${category}&limit=${PAGE_SIZE}&offset=${offset}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setImages(data.images);
        setTotal(data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [category, offset, search]);

  const loadFetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/gallery/fetch/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.status && data.status !== "idle") {
          setFetchJob(data);
          setFetching(ACTIVE_FETCH_STATUSES.has(data.status));
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadFetchStatus();
  }, [loadStats, loadFetchStatus]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  useEffect(() => {
    if (!fetching || !fetchJob?.job_id) return;

    const es = new EventSource(`${API_URL}/api/gallery/fetch/stream`);
    eventSourceRef.current = es;

    const handleProgress = (e: MessageEvent) => {
      const data = JSON.parse(e.data) as FetchJob;
      setFetchJob(data);
      setFetching(ACTIVE_FETCH_STATUSES.has(data.status));
    };

    const handleComplete = (e: MessageEvent) => {
      const data = JSON.parse(e.data) as FetchJob;
      setFetchJob(data);
      setFetching(false);
      loadStats();
      loadImages();
      es.close();
    };

    es.addEventListener("progress", handleProgress);
    es.addEventListener("complete", handleComplete);
    es.addEventListener("error", handleComplete);

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [fetching, fetchJob?.job_id, loadStats, loadImages]);

  const startFetch = async (scope: "missing" | "all") => {
    setFetching(true);
    try {
      const res = await fetch(`${API_URL}/api/gallery/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, workers: 4 }),
      });
      if (res.ok) {
        const data = await res.json();
        setFetchJob(data);
        setFetching(ACTIVE_FETCH_STATUSES.has(data.status));
      } else {
        const err = await res.json();
        alert(err.detail || t("fetch_error"));
        setFetching(false);
      }
    } catch (err) {
      console.error(err);
      setFetching(false);
    }
  };

  const stopFetch = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gallery/fetch/stop`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setFetchJob(data);
        setFetching(ACTIVE_FETCH_STATUSES.has(data.status));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isFetchActive = fetching || fetchJob?.status === "stopping";
  const showProgress = fetchJob && ACTIVE_FETCH_STATUSES.has(fetchJob.status);
  const showResult = fetchJob && FINISHED_FETCH_STATUSES.has(fetchJob.status);

  const dismissFetchResult = () => setFetchJob(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="space-y-4 text-start">
        <FeatureBadge icon={Images} label={tDash("badge_gallery")} />
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {t("title")} <span className="text-primary">{t("subtitle")}</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl">{t("description")}</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t("stat_local_total")} value={stats.local_total} icon={HardDrive} />
          <StatCard label={t("stat_product_local")} value={stats.local_product_images} icon={Package} />
          <StatCard label={t("stat_brand_local")} value={stats.local_brand_images} icon={Tag} />
          <StatCard
            label={t("stat_missing")}
            value={stats.catalog_products_missing + stats.catalog_brands_missing}
            icon={CloudOff}
            valueClassName="text-amber-600 dark:text-amber-400"
          />
        </div>
      )}

      <div className={cn(cardSurfaceClass, "p-6 space-y-4")}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t("fetch_panel_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("fetch_panel_desc")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={isFetchActive}
              onClick={() => startFetch("missing")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {isFetchActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {t("fetch_missing")}
            </button>
            <button
              disabled={isFetchActive}
              onClick={() => startFetch("all")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-muted/40 font-semibold text-sm hover:bg-muted disabled:opacity-50 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              {t("fetch_all")}
            </button>
            {fetching && fetchJob?.status !== "stopping" && (
              <button
                onClick={stopFetch}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-destructive/30 text-destructive font-semibold text-sm hover:bg-destructive/10 transition-all"
              >
                <StopCircle className="w-4 h-4" />
                {t("stop_fetch")}
              </button>
            )}
            {fetchJob?.status === "stopping" && (
              <span className="inline-flex items-center gap-2 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("stopping")}
              </span>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {showProgress && fetchJob ? (
            <FetchProgressPanel key="progress" job={fetchJob} t={t} />
          ) : showResult && fetchJob ? (
            <FetchResultSummary key="result" job={fetchJob} onDismiss={dismissFetchResult} t={t} />
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(["all", "products", "brands"] as CategoryFilter[]).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat);
                setOffset(0);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all",
                category === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {t(`filter_${cat}`)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("search_placeholder")}
            className="w-full ps-10 pe-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : images.length === 0 ? (
        <div className={cn(cardSurfaceClass, "p-16 text-center text-muted-foreground")}>
          <Images className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="font-medium">{t("empty_title")}</p>
          <p className="text-sm mt-1">{t("empty_desc")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map((img) => (
              <motion.div
                key={`${img.category}-${img.filename}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(cardSurfaceClass, "group overflow-hidden hover:shadow-lg transition-shadow")}
              >
                <div className="aspect-square bg-muted/30 relative overflow-hidden">
                  <img
                    src={`${API_URL}${img.url}`}
                    alt={img.label}
                    className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <span
                    className={cn(
                      "absolute top-2 end-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                      img.category === "products"
                        ? "bg-primary/90 text-primary-foreground"
                        : "bg-blue-600/90 text-white"
                    )}
                  >
                    {img.category === "products" ? t("product") : t("brand")}
                  </span>
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground line-clamp-2" title={img.label}>
                    {img.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate" title={img.filename}>
                    {img.filename}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatBytes(img.size_bytes)}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                {t("prev")}
              </button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages} ({total} {t("images_count")})
              </span>
              <button
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40"
              >
                {t("next")}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
