"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Barcode,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Clock,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  SkipForward,
  Square,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, API_URL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  StatCard,
  StatCardGrid,
  cardSurfaceClass,
  tableHeaderClass,
  tableRowClass,
} from "@/components/ui/stat-card";
import { FeatureBadge } from "@/components/shared/FeatureBadge";
import { useToast } from "@/components/ui/use-toast";
import { UploadZone } from "@/components/matcher/UploadZone";
import { EnrichmentHistorySkeleton, EnrichmentSkeleton } from "@/components/enrichment/EnrichmentSkeleton";
import { ApplyMatchedDialog } from "@/components/enrichment/ApplyMatchedDialog";
import { ResolveReviewDialog } from "@/components/enrichment/ResolveReviewDialog";
import { StopJobDialog } from "@/components/enrichment/StopJobDialog";

type EnrichmentStatus = "matched" | "review" | "no_match" | "already_synced";
type ApplyStatus = "pending" | "applied" | "skipped" | "overridden";
type ViewMode = "list" | "new" | "job";

interface EnrichmentRow {
  row_index: number;
  original_name: string;
  sheet_barcode?: string | null;
  sheet_code?: string | null;
  matching_method?: string;
  enrichment_status: EnrichmentStatus;
  review_reason?: string | null;
  apply_status?: ApplyStatus;
  db_product_id?: string | null;
  db_name_en?: string | null;
  db_international_barcode?: string | null;
  score?: number;
}

interface JobStats {
  total: number;
  matched: number;
  review: number;
  noMatch: number;
  alreadySynced: number;
  applied: number;
  pendingApply?: number;
  duration?: number | null;
}

interface EnrichmentJob {
  job_id: string;
  status: string;
  filename: string;
  total_rows: number;
  processed_rows?: number;
  matched_count?: number;
  review_count?: number;
  no_match_count?: number;
  already_synced_count?: number;
  applied_count?: number;
  created_at?: string;
  duration?: number | null;
  error_msg?: string | null;
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "matched", label: "Matched" },
  { key: "review", label: "Review" },
  { key: "already_synced", label: "Synced" },
  { key: "no_match", label: "No match" },
] as const;

function reasonLabel(reason?: string | null) {
  if (reason === "barcode_conflict") return "DB already has a different barcode";
  if (reason === "low_confidence") return "Low confidence match";
  if (reason === "missing_sheet_barcode") return "Missing sheet barcode";
  return reason || "";
}

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    running: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    failed: "bg-red-500/15 text-red-600 dark:text-red-300",
    stopped: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        styles[status] || styles.stopped
      )}
    >
      {status}
    </span>
  );
}

function StatusBadge({ status, apply }: { status: EnrichmentStatus; apply?: ApplyStatus }) {
  // Same badge styles as matcher ResultsTable
  let badge: React.ReactNode;
  switch (status) {
    case "matched":
      badge = (
        <span className="px-2 py-1 bg-success/10 text-success text-[10px] font-bold uppercase rounded-md border border-success/20">
          Matched
        </span>
      );
      break;
    case "review":
      badge = (
        <span className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-bold uppercase rounded-md border border-warning/20">
          Review
        </span>
      );
      break;
    case "already_synced":
      badge = (
        <span className="px-2 py-1 bg-sky-500/10 text-sky-600 dark:text-sky-300 text-[10px] font-bold uppercase rounded-md border border-sky-500/20">
          Synced
        </span>
      );
      break;
    default:
      badge = (
        <span className="px-2 py-1 bg-error/10 text-error text-[10px] font-bold uppercase rounded-md border border-error/20">
          No Match
        </span>
      );
  }

  if (!apply || apply === "pending") return badge;

  const applyBadge =
    apply === "skipped" ? (
      <span className="px-2 py-1 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold uppercase rounded-md border border-zinc-500/20">
        Skipped
      </span>
    ) : apply === "overridden" ? (
      <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-md border border-primary/20">
        Overridden
      </span>
    ) : (
      <span className="px-2 py-1 bg-success/10 text-success text-[10px] font-bold uppercase rounded-md border border-success/20">
        Applied
      </span>
    );

  return (
    <div className="flex flex-wrap gap-1">
      {badge}
      {applyBadge}
    </div>
  );
}

export default function EnrichmentDashboard() {
  const tDash = useTranslations("Dashboard");
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jobFromUrl = searchParams.get("job");

  const [view, setView] = useState<ViewMode>(jobFromUrl ? "job" : "list");
  const [history, setHistory] = useState<EnrichmentJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyQuery, setHistoryQuery] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [nameColumn, setNameColumn] = useState("");
  const [barcodeColumn, setBarcodeColumn] = useState("");
  const [codeColumn, setCodeColumn] = useState("");
  const [matchThreshold, setMatchThreshold] = useState(60);
  const [reviewThreshold, setReviewThreshold] = useState(40);

  const [isDetecting, setIsDetecting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const [resolvingRow, setResolvingRow] = useState<number | null>(null);
  const [resolveDialog, setResolveDialog] = useState<{
    action: "override" | "skip";
    row: EnrichmentRow;
  } | null>(null);

  const [activeJobId, setActiveJobId] = useState<string | null>(jobFromUrl);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<EnrichmentRow[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [serverTotal, setServerTotal] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isStopDialogOpen, setIsStopDialogOpen] = useState(false);
  const stopRequestedRef = useRef(false);
  const openedJobRef = useRef<string | null>(null);
  const pollAbortRef = useRef(false);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);
  const pageStateRef = useRef({
    statusFilter: "all",
    searchQuery: "",
    currentPage: 1,
    itemsPerPage: 50,
  });

  useEffect(() => {
    pageStateRef.current = {
      statusFilter,
      searchQuery,
      currentPage,
      itemsPerPage,
    };
  }, [statusFilter, searchQuery, currentPage, itemsPerPage]);

  const setJobInUrl = useCallback(
    (jobId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (jobId) params.set("job", jobId);
      else params.delete("job");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const pendingMatched = stats?.pendingApply ?? 0;
  const totalPages = Math.max(1, Math.ceil(serverTotal / itemsPerPage));
  const canResolveActions = jobStatus === "completed" || jobStatus === "stopped";

  const filteredHistory = useMemo(() => {
    if (!historyQuery) return history;
    const q = historyQuery.toLowerCase();
    return history.filter((j) => j.filename.toLowerCase().includes(q) || j.job_id.includes(q));
  }, [history, historyQuery]);

  const historyStats = useMemo(() => {
    const completed = history.filter((j) => j.status === "completed");
    return {
      total: history.length,
      active: history.filter((j) => j.status === "running" || j.status === "pending").length,
      applied: completed.reduce((sum, j) => sum + (j.applied_count || 0), 0),
      matched: completed.reduce((sum, j) => sum + (j.matched_count || 0), 0),
    };
  }, [history]);

  const hasActiveJobs = useMemo(
    () => history.some((j) => j.status === "running" || j.status === "pending"),
    [history]
  );

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/enrichment/jobs?limit=100`);
      if (res.ok) setHistory(await res.json());
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!hasActiveJobs) return;
    const id = setInterval(loadHistory, 4000);
    return () => clearInterval(id);
  }, [hasActiveJobs, loadHistory]);

  const fetchResults = useCallback(
    async (
      jobId: string,
      opts?: {
        status?: string;
        search?: string;
        page?: number;
        perPage?: number;
        silent?: boolean;
      }
    ) => {
      const page = opts?.page ?? pageStateRef.current.currentPage;
      const perPage = opts?.perPage ?? pageStateRef.current.itemsPerPage;
      const status = opts?.status ?? pageStateRef.current.statusFilter;
      const search = opts?.search ?? pageStateRef.current.searchQuery;
      // Don't let background poll clobber an in-flight user pagination fetch
      if (opts?.silent && isFetchingRef.current) {
        return null;
      }
      if (!opts?.silent) {
        isFetchingRef.current = true;
        setIsLoadingPage(true);
      }
      const params = new URLSearchParams({
        limit: String(perPage),
        offset: String((page - 1) * perPage),
      });
      if (status && status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      try {
        const res = await fetch(`${API_URL}/api/enrichment/job/${jobId}/results?${params}`);
        if (!res.ok) throw new Error("Failed to load results");
        const data = await res.json();
        setResults(data.results || []);
        setServerTotal(data.total ?? 0);
        if (data.stats) setStats(data.stats);
        if (data.job_status) setJobStatus(data.job_status);
        return data;
      } finally {
        if (!opts?.silent) {
          isFetchingRef.current = false;
          setIsLoadingPage(false);
        }
      }
    },
    []
  );

  const pollUntilDone = useCallback(
    async (jobId: string) => {
      stopRequestedRef.current = false;
      pollAbortRef.current = false;
      let tick = 0;
      for (let i = 0; i < 3600; i++) {
        if (stopRequestedRef.current || pollAbortRef.current) {
          setJobStatus("stopped");
          await fetchResults(jobId, { silent: true });
          return;
        }
        const res = await fetch(`${API_URL}/api/enrichment/job/${jobId}`);
        if (!res.ok) break;
        const job = await res.json();
        setProgress({ current: job.processed_rows || 0, total: job.total_rows || 0 });
        setJobStatus(job.status);
        setStats({
          total: job.total_rows || 0,
          matched: job.matched_count || 0,
          review: job.review_count || 0,
          noMatch: job.no_match_count || 0,
          alreadySynced: job.already_synced_count || 0,
          applied: job.applied_count || 0,
          pendingApply: job.pending_apply_count || 0,
          duration: job.duration,
        });

        // Refresh table from incremental results.json every poll (~1s)
        tick += 1;
        if (tick === 1 || tick % 2 === 0 || ["completed", "failed", "stopped"].includes(job.status)) {
          try {
            await fetchResults(jobId, { silent: true });
          } catch {
            /* keep polling */
          }
        }

        if (["completed", "failed", "stopped"].includes(job.status)) {
          if (job.status === "failed") throw new Error(job.error_msg || "Job failed");
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      throw new Error("Timed out waiting for job");
    },
    [fetchResults]
  );

  const openJob = useCallback(
    async (jobId: string, opts?: { force?: boolean }) => {
      // Prevent duplicate open/poll from URL effect / Strict Mode
      if (!opts?.force && openedJobRef.current === jobId) {
        return;
      }
      openedJobRef.current = jobId;
      pollAbortRef.current = true; // cancel any previous poll loop
      stopRequestedRef.current = false;

      setView("job");
      setActiveJobId(jobId);
      setJobInUrl(jobId);
      setIsLoadingJob(true);
      setIsRunning(false);
      setFile(null);
      setColumns([]);
      setStatusFilter("all");
      setSearchQuery("");
      setCurrentPage(1);
      setResults([]);
      setServerTotal(0);

      try {
        const jobRes = await fetch(`${API_URL}/api/enrichment/job/${jobId}`);
        if (!jobRes.ok) {
          throw new Error("Job not found");
        }
        const job = await jobRes.json();
        setJobStatus(job.status);
        setProgress({
          current: job.processed_rows || 0,
          total: job.total_rows || 0,
        });
        setStats({
          total: job.total_rows || 0,
          matched: job.matched_count || 0,
          review: job.review_count || 0,
          noMatch: job.no_match_count || 0,
          alreadySynced: job.already_synced_count || 0,
          applied: job.applied_count || 0,
          pendingApply: job.pending_apply_count || 0,
          duration: job.duration,
        });

        const shouldPoll = job.status === "running" || job.status === "pending";

        // Load first page of results (may be empty while still running)
        await fetchResults(jobId, { page: 1, perPage: itemsPerPage });

        // Unblock UI before long-running poll
        setIsLoadingJob(false);

        if (shouldPoll) {
          pollAbortRef.current = false;
          setIsRunning(true);
          try {
            await pollUntilDone(jobId);
            loadHistory();
          } catch (err: any) {
            if (!pollAbortRef.current && !stopRequestedRef.current) {
              toast({ title: "Job error", description: err.message, type: "error" });
            }
          } finally {
            setIsRunning(false);
          }
        }
      } catch (err: any) {
        toast({ title: "Load failed", description: err.message, type: "error" });
        setIsLoadingJob(false);
        setIsRunning(false);
        openedJobRef.current = null;
      }
    },
    [fetchResults, setJobInUrl, toast, loadHistory, pollUntilDone, itemsPerPage]
  );

  // Restore job from URL once on mount / when job id changes
  useEffect(() => {
    if (!jobFromUrl) {
      openedJobRef.current = null;
      return;
    }
    if (openedJobRef.current === jobFromUrl) return;
    openJob(jobFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobFromUrl]);

  const goList = () => {
    pollAbortRef.current = true;
    openedJobRef.current = null;
    setView("list");
    setActiveJobId(null);
    setJobInUrl(null);
    setResults([]);
    setStats(null);
    setFile(null);
    setColumns([]);
    setIsRunning(false);
    setIsLoadingJob(false);
    setJobStatus(null);
    loadHistory();
  };

  const startNew = () => {
    pollAbortRef.current = true;
    openedJobRef.current = null;
    setView("new");
    setActiveJobId(null);
    setJobInUrl(null);
    setResults([]);
    setStats(null);
    setFile(null);
    setColumns([]);
    setNameColumn("");
    setBarcodeColumn("");
    setCodeColumn("");
    setIsRunning(false);
    setIsLoadingJob(false);
    setJobStatus(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setIsDetecting(true);
    try {
      const form = new FormData();
      form.append("file", selected);
      const res = await fetch(`${API_URL}/api/enrichment/detect-columns`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to detect columns");
      }
      const data = await res.json();
      setColumns(data.columns || []);
      setNameColumn(data.suggested?.name_column || "");
      setBarcodeColumn(data.suggested?.barcode_column || "");
      setCodeColumn(data.suggested?.code_column || "");
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, type: "error" });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleRun = async () => {
    if (!file) return;
    if (!nameColumn || !barcodeColumn) {
      toast({
        title: "Columns required",
        description: "Select name and barcode columns",
        type: "error",
      });
      return;
    }
    setIsRunning(true);
    setResults([]);
    setStats(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name_column", nameColumn);
      form.append("barcode_column", barcodeColumn);
      if (codeColumn) form.append("code_column", codeColumn);
      form.append("match_threshold", (matchThreshold / 100).toFixed(2));
      form.append("review_threshold", (reviewThreshold / 100).toFixed(2));
      form.append("background", "true");

      const res = await fetch(`${API_URL}/api/enrichment/run`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to start job");
      }
      const job = await res.json();
      openedJobRef.current = job.job_id;
      pollAbortRef.current = false;
      stopRequestedRef.current = false;
      setActiveJobId(job.job_id);
      setJobInUrl(job.job_id);
      setView("job");
      setJobStatus("running");
      setIsLoadingJob(false);
      toast({
        title: "Job started",
        description: "Saved in history — you can refresh or leave and reopen anytime.",
      });
      loadHistory();
      await pollUntilDone(job.job_id);
      toast({ title: "Matching complete", description: "Review results, then apply matched rows" });
      loadHistory();
    } catch (err: any) {
      toast({ title: "Run failed", description: err.message, type: "error" });
    } finally {
      setIsRunning(false);
    }
  };

  const handleApplyMatched = async () => {
    if (!activeJobId) return;
    setIsApplying(true);
    try {
      const res = await fetch(`${API_URL}/api/enrichment/job/${activeJobId}/apply-matched`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Apply failed");
      }
      const data = await res.json();
      await fetchResults(activeJobId, {
        status: statusFilter,
        search: searchQuery,
        page: currentPage,
        perPage: itemsPerPage,
      });
      setIsApplyDialogOpen(false);
      toast({
        title: "Applied to catalog",
        description:
          `${data.applied} updated` +
          (data.already_same ? `, ${data.already_same} already same (skipped)` : "") +
          (data.errors?.length ? `, ${data.errors.length} errors` : ""),
      });
      loadHistory();
    } catch (err: any) {
      toast({ title: "Apply failed", description: err.message, type: "error" });
    } finally {
      setIsApplying(false);
    }
  };

  const handleStop = async () => {
    if (!activeJobId) return;
    setIsStopping(true);
    stopRequestedRef.current = true;
    try {
      await fetch(`${API_URL}/api/enrichment/job/${activeJobId}/stop`, { method: "POST" });
      setJobStatus("stopped");
      setIsRunning(false);
      setIsStopDialogOpen(false);
      await fetchResults(activeJobId, { page: 1, perPage: itemsPerPage });
      toast({ title: "Job stopped", description: "Partial results are available to review." });
      loadHistory();
    } catch (err: any) {
      toast({ title: "Stop failed", description: err.message, type: "error" });
    } finally {
      setIsStopping(false);
    }
  };

  const handleResolve = async (rowIndex: number, action: "override" | "skip") => {
    if (!activeJobId || !canResolveActions) return;
    setResolvingRow(rowIndex);
    try {
      const res = await fetch(`${API_URL}/api/enrichment/job/${activeJobId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row_index: rowIndex, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Resolve failed");
      }
      setResolveDialog(null);
      await fetchResults(activeJobId, {
        status: statusFilter,
        search: searchQuery,
        page: currentPage,
        perPage: itemsPerPage,
      });
      toast({
        title: action === "override" ? "Barcode overridden" : "Skipped",
        description: `Row ${rowIndex + 1}`,
      });
      loadHistory();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, type: "error" });
    } finally {
      setResolvingRow(null);
    }
  };

  const scrollTableToTop = useCallback(() => {
    tableScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Refetch when user changes filters/page (works while job is running too)
  const filtersKey = `${statusFilter}|${searchQuery}|${currentPage}|${itemsPerPage}`;
  useEffect(() => {
    if (!activeJobId || isLoadingJob || view !== "job") return;
    scrollTableToTop();
    const t = setTimeout(() => {
      fetchResults(activeJobId, {
        status: statusFilter,
        search: searchQuery,
        page: currentPage,
        perPage: itemsPerPage,
        silent: false,
      }).catch(() => undefined);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, activeJobId, view]);

  const goToPage = (page: number) => {
    const next = Math.max(1, Math.min(totalPages, page));
    if (next === currentPage) return;
    setCurrentPage(next);
    pageStateRef.current = { ...pageStateRef.current, currentPage: next };
  };

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <FeatureBadge icon={Barcode} label={tDash("badge_enrichment")} />
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Barcode <span className="text-primary">Enrichment</span>
          </h1>
          <p className="mt-2 font-medium text-zinc-500">
            Background jobs — refresh anytime; reopen from history to apply or review.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view !== "list" && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-full px-4"
              onClick={goList}
            >
              <ArrowLeft className="h-4 w-4" />
              All jobs
            </Button>
          )}
          {view === "job" && isRunning && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsStopDialogOpen(true)}
              disabled={isStopping}
              className="h-9 gap-2 rounded-full border-error/30 bg-error/10 px-4 text-error hover:bg-error/20 hover:text-error"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop matching
            </Button>
          )}
          {view === "list" ? (
            <Button
              type="button"
              size="sm"
              onClick={startNew}
              className="h-9 gap-2 rounded-full px-4 font-bold shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              New enrichment
            </Button>
          ) : (
            view === "job" &&
            !isRunning &&
            pendingMatched > 0 && (
              <Button
                size="sm"
                onClick={() => setIsApplyDialogOpen(true)}
                disabled={isApplying}
                className="h-9 gap-2 rounded-full bg-emerald-600 px-4 text-white hover:bg-emerald-700 hover:text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                Apply matched ({pendingMatched})
              </Button>
            )
          )}
        </div>
      </div>

      {view === "list" && (
        <>
          <StatCardGrid className="gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total jobs" value={historyStats.total} icon={Barcode} />
            <StatCard
              label="Active"
              value={historyStats.active}
              icon={Clock}
              iconClassName="text-sky-400"
              valueClassName="text-sky-400"
            />
            <StatCard
              label="Matched rows"
              value={historyStats.matched}
              icon={CheckCircle2}
              iconClassName="text-emerald-500"
            />
            <StatCard
              label="Applied to DB"
              value={historyStats.applied}
              icon={Check}
              iconClassName="text-warning"
            />
          </StatCardGrid>

          <div className={cn(cardSurfaceClass, "space-y-6 p-6")}>
            <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="Filter by filename…"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-2 self-start" onClick={loadHistory}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            {historyLoading ? (
              <EnrichmentHistorySkeleton />
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Barcode className="h-10 w-10 text-muted-foreground" />
                <p className="max-w-md text-sm text-muted-foreground">
                  No enrichment jobs yet. Upload a sheet with international barcodes to start.
                </p>
                <Button onClick={startNew} className="mt-2 gap-2 rounded-full">
                  <Plus className="h-4 w-4" />
                  New enrichment
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className={tableHeaderClass}>
                    <tr>
                      <th className="px-4 py-3">File</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Matched</th>
                      <th className="px-4 py-3">Review</th>
                      <th className="px-4 py-3">Applied</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((job) => (
                      <tr key={job.job_id} className={tableRowClass}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{job.filename}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {job.job_id.slice(0, 8)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <JobStatusBadge status={job.status} />
                        </td>
                        <td className="px-4 py-3 font-mono">{job.matched_count ?? 0}</td>
                        <td className="px-4 py-3 font-mono">{job.review_count ?? 0}</td>
                        <td className="px-4 py-3 font-mono">{job.applied_count ?? 0}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatWhen(job.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openJob(job.job_id, { force: true })}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                          >
                            Open
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {view === "new" && (
        <div className="space-y-6">
          {!file ? (
            <div>
              <UploadZone file={file} onFileChange={handleFileChange} />
            </div>
          ) : (
            <div className={cn(cardSurfaceClass, "space-y-6 p-6")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Uploaded sheet
                  </p>
                  <p className="mt-1 font-semibold">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · {columns.length} columns
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Change file
                </Button>
              </div>

              {isDetecting ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Detecting columns…
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.5fr_1fr]">
                  <div className="space-y-4 border rounded-xl p-4">
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium text-muted-foreground">Name column</span>
                      <select
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                        value={nameColumn}
                        onChange={(e) => setNameColumn(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium text-muted-foreground">Barcode column</span>
                      <select
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                        value={barcodeColumn}
                        onChange={(e) => setBarcodeColumn(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium text-muted-foreground">Code (optional)</span>
                      <select
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                        value={codeColumn}
                        onChange={(e) => setCodeColumn(e.target.value)}
                      >
                        <option value="">None</option>
                        {columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-col space-y-4">
                    <div className="mb-auto border rounded-xl p-4">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-muted-foreground">
                          Match threshold ({matchThreshold}%)
                        </span>
                        <input
                          type="range"
                          min={40}
                          max={100}
                          value={matchThreshold}
                          onChange={(e) => setMatchThreshold(Number(e.target.value))}
                          className="w-full"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-muted-foreground">
                          Review threshold ({reviewThreshold}%)
                        </span>
                        <input
                          type="range"
                          min={20}
                          max={matchThreshold}
                          value={reviewThreshold}
                          onChange={(e) => setReviewThreshold(Number(e.target.value))}
                          className="w-full"
                        />
                      </label>
                    </div>

                    <Button
                      onClick={handleRun}
                      disabled={isRunning || !nameColumn || !barcodeColumn}
                      className="w-full gap-2 rounded-full py-6 text-base font-bold sm:w-auto sm:px-8"
                    >
                      {isRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Run matching job
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === "job" && (
        <div className="space-y-6">
          {isLoadingJob ? (
            <EnrichmentSkeleton />
          ) : (
            <>
              {(isRunning || jobStatus === "running") && progress.total > 0 && (
                <div className={cn(cardSurfaceClass, "space-y-2 p-5")}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Matching in background…
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {progress.current}/{progress.total}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, (progress.current / Math.max(progress.total, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Safe to refresh — this job stays in history and will reopen from the URL.
                  </p>
                </div>
              )}

              {stats && (
                <StatCardGrid className="gap-4 md:grid-cols-3 lg:grid-cols-6">
                  <StatCard label="Total" value={stats.total} icon={Barcode} />
                  <StatCard
                    label="Matched"
                    value={stats.matched}
                    icon={CheckCircle2}
                    iconClassName="text-emerald-500"
                  />
                  <StatCard
                    label="Review"
                    value={stats.review}
                    icon={AlertTriangle}
                    iconClassName="text-amber-500"
                  />
                  <StatCard
                    label="Synced"
                    value={stats.alreadySynced}
                    icon={RefreshCw}
                    iconClassName="text-sky-500"
                  />
                  <StatCard
                    label="Applied"
                    value={stats.applied}
                    icon={Check}
                    iconClassName="text-emerald-600"
                  />
                  <StatCard
                    label="No match"
                    value={stats.noMatch}
                    icon={CircleSlash}
                    iconClassName="text-zinc-500"
                  />
                </StatCardGrid>
              )}

              <div className={cn(cardSurfaceClass, "space-y-4 p-5 md:p-6")}>
                <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_FILTERS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => {
                          setStatusFilter(f.key);
                          setCurrentPage(1);
                          pageStateRef.current = {
                            ...pageStateRef.current,
                            statusFilter: f.key,
                            currentPage: 1,
                          };
                        }}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                          statusFilter === f.key
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Show</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setItemsPerPage(val);
                          setCurrentPage(1);
                          pageStateRef.current = {
                            ...pageStateRef.current,
                            itemsPerPage: val,
                            currentPage: 1,
                          };
                        }}
                        className="rounded-lg border border-border bg-background p-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                      >
                        {[25, 50, 100, 200].map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {serverTotal} total filtered
                    </span>
                    <div className="relative w-full sm:w-64">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                          pageStateRef.current = {
                            ...pageStateRef.current,
                            searchQuery: e.target.value,
                            currentPage: 1,
                          };
                        }}
                        placeholder="Search name / barcode…"
                        className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>

                <div ref={tableScrollRef} className="max-h-[560px] overflow-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className={cn(tableHeaderClass, "sticky top-0 z-10 bg-card")}>
                      <tr>
                        <th className="px-3 py-3">#</th>
                        <th className="px-3 py-3">Sheet product</th>
                        <th className="px-3 py-3">Sheet barcode</th>
                        <th className="px-3 py-3">DB product</th>
                        <th className="px-3 py-3">DB barcode</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingPage ? (
                        Array.from({ length: Math.min(itemsPerPage, 10) }).map((_, idx) => (
                          <tr key={`sk-${idx}`} className={cn(tableRowClass, "animate-pulse")}>
                            <td className="px-3 py-3">
                              <div className="h-3 w-6 rounded bg-zinc-300 dark:bg-zinc-800" />
                            </td>
                            <td className="px-3 py-3">
                              <div className="space-y-2">
                                <div className="h-4 w-3/4 max-w-[220px] rounded bg-zinc-300 dark:bg-zinc-800" />
                                <div className="h-3 w-1/2 max-w-[140px] rounded bg-zinc-200 dark:bg-zinc-900" />
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="h-3 w-28 rounded bg-zinc-300 dark:bg-zinc-800" />
                            </td>
                            <td className="px-3 py-3">
                              <div className="space-y-2">
                                <div className="h-4 w-4/5 max-w-[200px] rounded bg-zinc-300 dark:bg-zinc-800" />
                                <div className="h-3 w-1/3 max-w-[100px] rounded bg-zinc-200 dark:bg-zinc-900" />
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="h-3 w-24 rounded bg-zinc-300 dark:bg-zinc-800" />
                            </td>
                            <td className="px-3 py-3">
                              <div className="h-6 w-16 rounded-md bg-zinc-300 dark:bg-zinc-800" />
                            </td>
                            <td className="px-3 py-3">
                              <div className="h-8 w-20 rounded-lg bg-zinc-300 dark:bg-zinc-800" />
                            </td>
                          </tr>
                        ))
                      ) : results.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                            {isRunning
                              ? "Results will appear as rows are processed…"
                              : "No rows for this filter."}
                          </td>
                        </tr>
                      ) : (
                        results.map((row) => {
                          const isConflict = row.review_reason === "barcode_conflict";
                          const busy = resolvingRow === row.row_index;
                          return (
                            <tr key={row.row_index} className={cn(tableRowClass, "align-top")}>
                              <td className="px-3 py-3 text-muted-foreground">{row.row_index + 1}</td>
                              <td className="px-3 py-3">
                                <div className="font-medium">{row.original_name || "—"}</div>
                                {row.score != null && (
                                  <div className="text-xs text-muted-foreground">
                                    {(row.score * 100).toFixed(0)}% · {row.matching_method}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 font-mono text-xs">
                                {row.sheet_barcode || "—"}
                              </td>
                              <td className="px-3 py-3">
                                <div>{row.db_name_en || "—"}</div>
                                {row.db_product_id && (
                                  <div className="text-xs text-muted-foreground">
                                    id: {row.db_product_id}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 font-mono text-xs">
                                {row.db_international_barcode || (
                                  <span className="text-muted-foreground">empty</span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-col gap-1">
                                  <StatusBadge status={row.enrichment_status} apply={row.apply_status} />
                                  {row.review_reason && (
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 text-xs",
                                        isConflict
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      {isConflict && <AlertTriangle className="h-3 w-3" />}
                                      {reasonLabel(row.review_reason)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                {row.enrichment_status === "review" &&
                                  row.apply_status !== "skipped" &&
                                  row.apply_status !== "overridden" &&
                                  row.apply_status !== "applied" &&
                                  (canResolveActions ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy}
                                        className="h-8 gap-1"
                                        onClick={() =>
                                          setResolveDialog({ action: "override", row })
                                        }
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                        Override
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy}
                                        className="h-8 gap-1"
                                        onClick={() => setResolveDialog({ action: "skip", row })}
                                      >
                                        <SkipForward className="h-3.5 w-3.5" />
                                        Skip
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Available when job finishes
                                    </span>
                                  ))}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {(serverTotal > 0 || isRunning) && (
                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground">
                      Page {currentPage} of {totalPages}
                      {serverTotal > 0 ? ` · ${serverTotal} rows` : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1 || isLoadingPage}
                        onClick={() => goToPage(currentPage - 1)}
                        className="gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages || isLoadingPage || serverTotal === 0}
                        onClick={() => goToPage(currentPage + 1)}
                        className="gap-1"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeJobId && (
        <ApplyMatchedDialog
          isOpen={isApplyDialogOpen}
          onClose={() => {
            if (!isApplying) setIsApplyDialogOpen(false);
          }}
          jobId={activeJobId}
          pendingCount={pendingMatched}
          isApplying={isApplying}
          onConfirm={handleApplyMatched}
        />
      )}

      <ResolveReviewDialog
        isOpen={!!resolveDialog}
        action={resolveDialog?.action ?? null}
        row={resolveDialog?.row ?? null}
        isSubmitting={resolvingRow === resolveDialog?.row.row_index}
        onClose={() => {
          if (resolvingRow == null) setResolveDialog(null);
        }}
        onConfirm={() => {
          if (!resolveDialog) return;
          handleResolve(resolveDialog.row.row_index, resolveDialog.action);
        }}
      />

      <StopJobDialog
        isOpen={isStopDialogOpen}
        isStopping={isStopping}
        processed={progress.current}
        total={progress.total}
        onClose={() => {
          if (!isStopping) setIsStopDialogOpen(false);
        }}
        onConfirm={handleStop}
      />
    </div>
  );
}
