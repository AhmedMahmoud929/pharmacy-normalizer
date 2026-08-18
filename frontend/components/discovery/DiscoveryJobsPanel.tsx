"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CircleSlash,
  HelpCircle,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  Upload,
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
import { useToast } from "@/components/ui/use-toast";
import { UploadZone } from "@/components/matcher/UploadZone";

type DiscoveryStatus = "found" | "review" | "not_found";
type PanelMode = "list" | "new" | "job";

interface DiscoveryJob {
  job_id: string;
  status: string;
  filename: string;
  input_type: string;
  total_rows: number;
  processed_rows?: number;
  found_count?: number;
  review_count?: number;
  not_found_count?: number;
  imported_count?: number;
  created_at?: string;
  duration?: number | null;
}

interface DiscoveryRow {
  row_index: number;
  original_name: string;
  discovery_status: DiscoveryStatus;
  source_domain?: string;
  source_url?: string;
  title_en?: string;
  price?: number;
  image_url?: string;
  score?: number;
  import_status?: string;
  candidates?: Array<Record<string, unknown>>;
}

interface MatcherJobOption {
  job_id: string;
  filename: string;
  no_match_count: number;
}

interface SourceOption {
  domain: string;
  display_name: string;
  platform: string;
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "found", label: "Found" },
  { key: "review", label: "Review" },
  { key: "not_found", label: "Not found" },
] as const;

function StatusBadge({ status }: { status: DiscoveryStatus }) {
  const map: Record<DiscoveryStatus, string> = {
    found: "bg-success/10 text-success border-success/20",
    review: "bg-warning/10 text-warning border-warning/20",
    not_found: "bg-error/10 text-error border-error/20",
  };
  return (
    <span className={cn("px-2 py-1 text-[10px] font-bold uppercase rounded-md border", map[status])}>
      {status.replace("_", " ")}
    </span>
  );
}

export function DiscoveryJobsPanel({
  mode,
  jobId,
}: {
  mode: PanelMode;
  jobId?: string;
}) {
  const t = useTranslations("Discovery");
  const { toast } = useToast();
  const router = useRouter();

  const [history, setHistory] = useState<DiscoveryJob[]>([]);
  const [jobMeta, setJobMeta] = useState<DiscoveryJob | null>(null);
  const [rows, setRows] = useState<DiscoveryRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [importing, setImporting] = useState(false);

  const [inputType, setInputType] = useState<"matcher" | "upload">("matcher");
  const [matcherJobs, setMatcherJobs] = useState<MatcherJobOption[]>([]);
  const [selectedMatcherJob, setSelectedMatcherJob] = useState("");
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [nameColumn, setNameColumn] = useState("");
  const [columns, setColumns] = useState<string[]>([]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/discovery/jobs?limit=50`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: t("error_load_jobs"), type: "error" });
    }
  }, [t, toast]);

  const fetchJobResults = useCallback(async (activeId: string, filter: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200", offset: "0" });
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`${API_URL}/api/discovery/job/${activeId}/results?${params}`);
      const data = await res.json();
      setRows(data.results || []);
      setStats(data.stats || {});
      const metaRes = await fetch(`${API_URL}/api/discovery/job/${activeId}`);
      const meta = await metaRes.json();
      setJobMeta(meta);
      return meta as DiscoveryJob;
    } catch {
      toast({ title: t("error_load_results"), type: "error" });
      return null;
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    if (mode === "list") {
      fetchHistory();
    }
  }, [mode, fetchHistory]);

  useEffect(() => {
    if (mode === "new" || mode === "job") {
      fetch(`${API_URL}/api/discovery/matcher-jobs`).then((r) => r.json()).then((d) => setMatcherJobs(d.jobs || []));
      fetch(`${API_URL}/api/discovery/sources`).then((r) => r.json()).then((d) => {
        const profiles = d.profiles || [];
        setSources(profiles);
        setSelectedSources(profiles.map((p: SourceOption) => p.domain));
      });
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "job" || !jobId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      const meta = await fetchJobResults(jobId, statusFilter);
      if (cancelled || !meta) return;
      const terminal = ["completed", "stopped", "failed"].includes(meta.status);
      if (terminal && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    poll();
    timer = setInterval(poll, 4000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [mode, jobId, statusFilter, fetchJobResults]);

  const detectColumns = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/api/discovery/detect-columns`, { method: "POST", body: fd });
    const data = await res.json();
    setColumns(data.columns || []);
    if (data.suggested?.name_column) setNameColumn(data.suggested.name_column);
  };

  const runJob = async () => {
    setRunning(true);
    try {
      const fd = new FormData();
      fd.append("input_type", inputType);
      fd.append("match_threshold", "0.60");
      fd.append("review_threshold", "0.40");
      fd.append("background", "true");
      fd.append("source_domains", JSON.stringify(selectedSources));
      if (inputType === "matcher") {
        if (!selectedMatcherJob) throw new Error(t("pick_matcher_job"));
        fd.append("matcher_job_id", selectedMatcherJob);
      } else {
        if (!uploadFile) throw new Error(t("pick_file"));
        fd.append("file", uploadFile);
        if (nameColumn) fd.append("name_column", nameColumn);
      }
      const res = await fetch(`${API_URL}/api/discovery/run`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const job = await res.json();
      const id = job?.job_id as string | undefined;
      if (!id) throw new Error("Missing job id");
      toast({ title: t("job_started") });
      setRunning(false);
      router.push(`/dashboard/discovery/jobs/${id}`);
    } catch (e) {
      setRunning(false);
      toast({ title: t("error_run"), description: String(e), type: "error" });
    }
  };

  const stopJob = async () => {
    if (!jobId) return;
    setStopping(true);
    try {
      const res = await fetch(`${API_URL}/api/discovery/job/${jobId}/stop`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: t("job_stopped") });
      await fetchJobResults(jobId, statusFilter);
    } catch (e) {
      toast({ title: t("error_stop"), description: String(e), type: "error" });
    } finally {
      setStopping(false);
    }
  };

  const isJobActive =
    jobMeta?.status === "running" || jobMeta?.status === "pending";
  const processedCount = jobMeta?.processed_rows ?? 0;
  const totalCount = jobMeta?.total_rows ?? stats.total ?? 0;

  const resolveRow = async (rowIndex: number, action: string, candidateIndex?: number) => {
    if (!jobId) return;
    const res = await fetch(`${API_URL}/api/discovery/job/${jobId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row_index: rowIndex, action, candidate_index: candidateIndex }),
    });
    if (res.ok) fetchJobResults(jobId, statusFilter);
  };

  const importFound = async () => {
    if (!jobId) return;
    setImporting(true);
    try {
      const res = await fetch(`${API_URL}/api/discovery/job/${jobId}/import`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");
      toast({ title: t("imported_count", { count: data.imported }) });
      fetchJobResults(jobId, statusFilter);
    } catch (e) {
      toast({ title: t("error_import"), description: String(e), type: "error" });
    } finally {
      setImporting(false);
    }
  };

  if (mode === "new") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/dashboard/discovery/jobs")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Button>
        <div className={cn(cardSurfaceClass, "p-6 space-y-6")}>
          <div className="flex gap-2">
            <Button variant={inputType === "matcher" ? "default" : "outline"} onClick={() => setInputType("matcher")}>
              {t("from_matcher")}
            </Button>
            <Button variant={inputType === "upload" ? "default" : "outline"} onClick={() => setInputType("upload")}>
              <Upload className="h-4 w-4 mr-1" /> {t("from_upload")}
            </Button>
          </div>

          {inputType === "matcher" ? (
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={selectedMatcherJob}
              onChange={(e) => setSelectedMatcherJob(e.target.value)}
            >
              <option value="">{t("pick_matcher_job")}</option>
              {matcherJobs.map((j) => (
                <option key={j.job_id} value={j.job_id}>
                  {j.filename} — {j.no_match_count} no-match
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-3">
              <UploadZone
                file={uploadFile}
                onFileChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setUploadFile(f);
                    detectColumns(f);
                  }
                }}
              />
              {columns.length > 0 && (
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={nameColumn}
                  onChange={(e) => setNameColumn(e.target.value)}
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t("sources_to_search")}</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((s) => (
                <label key={s.domain} className="flex items-center gap-1.5 text-sm border rounded-md px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(s.domain)}
                    onChange={(e) => {
                      setSelectedSources((prev) =>
                        e.target.checked ? [...prev, s.domain] : prev.filter((d) => d !== s.domain)
                      );
                    }}
                  />
                  {s.display_name || s.domain}
                </label>
              ))}
            </div>
          </div>

          <Button onClick={runJob} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {t("run_discovery")}
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "job" && jobId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => router.push("/dashboard/discovery/jobs")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> {t("back")}
          </Button>
          <div className="flex gap-2">
            {isJobActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={stopJob}
                disabled={stopping}
                className="gap-2 text-error border-error/30 hover:bg-error/10"
              >
                {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4 fill-current" />}
                {t("stop_job")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => fetchJobResults(jobId, statusFilter)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={importFound} disabled={importing || isJobActive}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {t("import_found")}
            </Button>
          </div>
        </div>

        {isJobActive && (
          <div className={cn(cardSurfaceClass, "p-4 flex flex-wrap items-center gap-3")}>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="text-sm">
              <span className="font-medium">{t("job_running")}</span>
              <span className="text-muted-foreground ml-2">
                {processedCount} / {totalCount} {t("stat_processed")}
              </span>
            </div>
          </div>
        )}

        <StatCardGrid>
          <StatCard label={t("stat_total")} value={stats.total ?? jobMeta?.total_rows ?? 0} icon={Search} />
          <StatCard label={t("stat_found")} value={stats.found ?? 0} icon={CheckCircle2} iconClassName="text-success" />
          <StatCard label={t("stat_review")} value={stats.review ?? 0} icon={HelpCircle} iconClassName="text-warning" />
          <StatCard label={t("stat_not_found")} value={stats.notFound ?? 0} icon={CircleSlash} iconClassName="text-error" />
        </StatCardGrid>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={statusFilter === f.key ? "default" : "outline"}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className={cn(cardSurfaceClass, "overflow-x-auto")}>
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <table className="w-full text-sm min-w-[800px]">
              <thead><tr className={tableHeaderClass}>
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">{t("query")}</th>
                <th className="p-3 text-left">{t("result")}</th>
                <th className="p-3 text-left">{t("source")}</th>
                <th className="p-3 text-left">{t("score")}</th>
                <th className="p-3 text-left">{t("status")}</th>
                <th className="p-3" />
              </tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.row_index} className={tableRowClass}>
                    <td className="p-3">{row.row_index + 1}</td>
                    <td className="p-3 max-w-[180px] truncate">{row.original_name}</td>
                    <td className="p-3 max-w-[200px]">
                      <div className="truncate">{row.title_en || "—"}</div>
                      {row.price != null && <div className="text-xs text-muted-foreground">EGP {row.price}</div>}
                    </td>
                    <td className="p-3 text-xs">{row.source_domain || "—"}</td>
                    <td className="p-3">{row.score != null ? `${(row.score * 100).toFixed(0)}%` : "—"}</td>
                    <td className="p-3"><StatusBadge status={row.discovery_status} /></td>
                    <td className="p-3">
                      {row.discovery_status === "review" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => resolveRow(row.row_index, "accept")}>✓</Button>
                          <Button size="sm" variant="ghost" onClick={() => resolveRow(row.row_index, "reject")}>✗</Button>
                        </div>
                      )}
                      {row.source_url && (
                        <a href={row.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                          link
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => router.push("/dashboard/discovery/jobs/new")} className="gap-2">
          <Plus className="h-4 w-4" /> {t("new_job")}
        </Button>
      </div>
      <div className={cn(cardSurfaceClass, "overflow-hidden")}>
        <table className="w-full text-sm">
          <thead><tr className={tableHeaderClass}>
            <th className="p-3 text-left">{t("file")}</th>
            <th className="p-3 text-left">{t("status")}</th>
            <th className="p-3 text-left">{t("stat_found")}</th>
            <th className="p-3 text-left">{t("created")}</th>
            <th className="p-3" />
          </tr></thead>
          <tbody>
            {history.map((job) => (
              <tr key={job.job_id} className={tableRowClass}>
                <td className="p-3">{job.filename}</td>
                <td className="p-3 capitalize">{job.status}</td>
                <td className="p-3">{job.found_count ?? 0} / {job.total_rows}</td>
                <td className="p-3 text-xs text-muted-foreground">{job.created_at?.slice(0, 16)}</td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/discovery/jobs/${job.job_id}`)}
                  >
                    {t("open")}
                  </Button>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t("no_jobs")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
