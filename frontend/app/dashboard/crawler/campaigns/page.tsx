"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  History,
  RefreshCw,
  Search,
  FileText,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Image
} from "lucide-react";
import { motion } from "framer-motion";
import { useCrawler } from "../crawler-context";

const formatDurationSecs = (secs: number) => {
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${s}s`;
  }
  return `${s}s`;
};

const formatDuration = (job: any) => {
  if (job.status === "running" || job.status === "pending") {
    return (
      <span className="text-sky-400 font-semibold animate-pulse flex items-center gap-1">
        <span className="w-1 h-1 bg-sky-400 rounded-full animate-ping" />
        Active
      </span>
    );
  }
  const secs = job.duration;
  if (secs === undefined || secs === null) {
    if (job.finished_at && job.started_at) {
      const diff = Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000);
      return formatDurationSecs(Math.max(0, diff));
    }
    return "—";
  }
  return formatDurationSecs(secs);
};

export default function CampaignsPage() {
  const router = useRouter();
  
  const {
    jobs,
    loadJobsHistory,
    setActiveJobId,
    connectToTelemetryStream,
    setShowParamsForm,
    handleStopCampaign,
    setSelectedJobIdForBrowse,
    setExpPage,
    handleDownload,
    triggerMediaFetch,
    formatTime
  } = useCrawler();

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyId = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(jobId);
    setCopiedId(jobId);
    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };

  const handleViewLive = (jobId: string) => {
    setActiveJobId(jobId);
    connectToTelemetryStream(jobId);
    setShowParamsForm(false);
    router.push(`/dashboard/crawler?job_id=${jobId}`);
  };

  const handleBrowseItems = (jobId: string) => {
    setSelectedJobIdForBrowse(jobId);
    setExpPage(1);
    router.push(`/dashboard/crawler/explorer?job_id=${jobId}`);
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl shadow-xl"
    >
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-6">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Campaign executions history
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Review active and completed jobs, check errors, and download assets files.</p>
        </div>
        <button
          onClick={loadJobsHistory}
          className="p-2 bg-zinc-950 rounded-md border border-zinc-800 hover:border-zinc-700 hover:text-primary transition-colors flex items-center gap-1.5 text-xs cursor-pointer font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* History Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
              <th className="pb-3 pl-2">Campaign ID</th>
              <th className="pb-3">Type</th>
              <th className="pb-3">Parameters</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Telemetry progress</th>
              <th className="pb-3">Duration</th>
              <th className="pb-3">Triggered At</th>
              <th className="pb-3 pr-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-500 italic">No historical crawl campaigns found in SQLite databases.</td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.job_id} className="hover:bg-zinc-950/20 group">
                  {/* Job ID */}
                  <td className="py-4 pl-2">
                    <button
                      onClick={(e) => handleCopyId(job.job_id, e)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 transition-all font-mono text-[10px] cursor-pointer group/badge max-w-[130px] w-full"
                      title="Click to copy full Campaign ID"
                    >
                      <span className="truncate flex-1 text-left">
                        {job.job_id}
                      </span>
                      {copiedId === job.job_id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-zinc-600 group-hover/badge:text-zinc-400 transition-colors shrink-0" />
                      )}
                    </button>
                  </td>
                  {/* Target type */}
                  <td className="py-4 font-semibold capitalize text-zinc-200">
                    {job.target}
                  </td>
                  {/* Params summary */}
                  <td className="py-4 text-[10px] text-zinc-400 max-w-[200px] truncate">
                    <span className="bg-zinc-950 px-2 py-1 rounded border border-zinc-800 text-zinc-400 font-mono mr-1.5 uppercase">
                      {job.params.country}-{job.params.lang}
                    </span>
                    {job.params.deep && <span className="text-primary mr-1.5 font-medium">DEEP</span>}
                    {job.params.localize && <span className="text-indigo-400 mr-1.5 font-medium">LOCALIZED</span>}
                    Pages: {job.params.pages}
                  </td>
                  {/* Status Badge */}
                  <td className="py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${job.status === "completed"
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      : job.status === "running"
                        ? "bg-sky-500/10 border border-sky-500/20 text-sky-400 animate-pulse"
                        : job.status === "pending"
                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse"
                          : job.status === "stopped"
                            ? "bg-zinc-500/10 border border-zinc-500/20 text-zinc-400"
                            : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                      }`}>
                      {job.status === "running" && <span className="w-1 h-1 bg-sky-400 rounded-full animate-ping" />}
                      {job.status === "pending" && <span className="w-1 h-1 bg-amber-400 rounded-full animate-ping" />}
                      {job.status}
                    </span>
                  </td>
                  {/* Progress bar */}
                  <td className="py-4">
                    <div className="flex flex-col gap-1.5 max-w-[150px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[9px] text-zinc-400">
                          <span>
                            {job.target === "products" ? (
                              `${job.progress.products_found || 0} products`
                            ) : job.target === "brands" ? (
                              `${job.progress.products_found || 0} brands`
                            ) : job.target === "categories" ? (
                              `${job.progress.processed_categories || 0} categories`
                            ) : (
                              `${job.progress.processed_categories || 0} sub-categories`
                            )}
                          </span>
                          {job.progress.total_categories > 0 && (
                            <span>{Math.round((job.progress.processed_categories / job.progress.total_categories) * 100)}%</span>
                          )}
                        </div>
                        {job.progress.total_categories > 0 && (
                          <div className="w-full bg-zinc-950 h-1 rounded-full overflow-hidden">
                            <div
                              className="bg-primary-dark h-full"
                              style={{ width: `${(job.progress.processed_categories / job.progress.total_categories) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Standalone Media Stage */}
                      {job.target === "products" && (() => {
                        const total = job.images_total || 0;
                        const completed = job.images_completed || 0;
                        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                        return (
                          <div className="mt-1 pt-1 border-t border-zinc-800/60 flex flex-col gap-0.5">
                            <div className="flex justify-between text-[8px] tracking-wider uppercase font-bold text-zinc-500">
                              <span>Image Stage</span>
                              <span className={
                                job.media_status === "completed" ? "text-emerald-400 font-extrabold" :
                                job.media_status === "running" ? "text-sky-400 animate-pulse font-extrabold" :
                                job.media_status === "failed" ? "text-rose-400 font-extrabold" : "text-zinc-600"
                              }>
                                {job.media_status || "none"}
                              </span>
                            </div>
                            {job.media_status === "running" && total > 0 && (
                              <div className="flex flex-col gap-1 mt-0.5">
                                <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
                                  <span>{completed} / {total}</span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="w-full bg-zinc-950 h-0.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-sky-400 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  {/* Duration */}
                  <td className="py-4 text-[10px] text-zinc-300 font-medium font-mono">
                    {formatDuration(job)}
                  </td>
                  {/* Created date */}
                  <td className="py-4 text-[10px] text-zinc-400">
                    {formatTime(job.created_at)}
                  </td>
                  {/* Actions panel */}
                  <td className="py-4 pr-2 text-right space-x-2">
                    {job.status === "running" || job.status === "pending" ? (
                      <>
                        <button
                          onClick={() => handleViewLive(job.job_id)}
                          className="py-1 px-2.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500 hover:text-black transition-all cursor-pointer font-medium"
                        >
                          View Live
                        </button>
                        <button
                          onClick={() => handleStopCampaign(job.job_id)}
                          className="py-1 px-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-black transition-all cursor-pointer font-medium"
                        >
                          Stop
                        </button>
                      </>
                    ) : (() => {
                      const isDataEmpty = job.target === "categories" || job.target === "sub-categories"
                        ? (job.progress.processed_categories || 0) === 0
                        : (job.progress.products_found || 0) === 0;

                      return (
                        <div className="inline-flex items-center gap-1.5 bg-zinc-950/80 p-1 rounded-lg border border-zinc-800">
                          <button
                            onClick={() => handleBrowseItems(job.job_id)}
                            disabled={isDataEmpty}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-primary transition-colors disabled:opacity-30 cursor-pointer"
                            title="Browse Scraped Items"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownload(job.job_id, "json")}
                            disabled={isDataEmpty}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors disabled:opacity-30 cursor-pointer"
                            title="Download JSON"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownload(job.job_id, "excel")}
                            disabled={isDataEmpty}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-30 cursor-pointer"
                            title="Download Excel Sheet"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>
                          {job.target === "products" && job.status === "completed" && (!job.media_status || job.media_status === "none" || job.media_status === "failed") && (
                            <button
                              onClick={() => triggerMediaFetch(job.job_id)}
                              className="p-1.5 rounded hover:bg-zinc-800 text-sky-400 hover:text-sky-300 transition-colors cursor-pointer animate-pulse"
                              title="Trigger Standalone Image Stage Extraction"
                            >
                              <Image className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDownload(job.job_id, "media")}
                            disabled={!job.media_zip}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-indigo-400 transition-colors disabled:opacity-30 cursor-pointer"
                            title="Download Media ZIP"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
