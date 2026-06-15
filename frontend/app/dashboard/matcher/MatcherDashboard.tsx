"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Clock, Plus, FileSpreadsheet, Download, Loader2,
  CheckCircle, AlertCircle, Search, ArrowRight, TrendingUp, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportDialog } from "@/components/matcher/ExportDialog";
import { DeleteCampaignModal } from "@/components/matcher/DeleteCampaignModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MatchJob {
  job_id: string;
  filename: string;
  column_used: string;
  match_threshold: number;
  review_threshold: number;
  total_rows: number;
  processed_rows: number;
  matched_count: number;
  review_count: number;
  no_match_count: number;
  status: "pending" | "running" | "completed" | "failed" | "stopped";
  error_msg: string | null;
  created_at: string;
}

export default function MatcherDashboard() {
  const [jobs, setJobs] = useState<MatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedJobResults, setSelectedJobResults] = useState<any[]>([]);
  const [exportingJobId, setExportingJobId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<{ id: string; filename: string } | null>(null);

  const handleExportClick = async (jobId: string) => {
    setExportingJobId(jobId);
    try {
      const response = await fetch(`${API_URL}/api/matcher/job/${jobId}/results?limit=100000`);
      if (response.ok) {
        const data = await response.json();
        setSelectedJobResults(data.results || []);
        setActiveJobId(jobId);
        setIsExportDialogOpen(true);
      }
    } catch (err) {
      console.error("Failed to fetch results for export:", err);
    } finally {
      setExportingJobId(null);
    }
  };

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/matcher/jobs?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to fetch match history campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();

    // Set up polling for active/running jobs
    const interval = setInterval(() => {
      fetchJobs();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchJobs]);

  const filteredJobs = useMemo(() => {
    if (!searchQuery) return jobs;
    const q = searchQuery.toLowerCase();
    return jobs.filter(j =>
      j.filename.toLowerCase().includes(q) ||
      (j.column_used && j.column_used.toLowerCase().includes(q))
    );
  }, [jobs, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = jobs.length;
    const completedJobs = jobs.filter(j => j.status === "completed");

    // Average accuracy across all completed runs
    let totalAcc = 0;
    completedJobs.forEach(j => {
      if (j.total_rows > 0) {
        totalAcc += (j.matched_count / j.total_rows) * 100;
      }
    });
    const avgAccuracy = completedJobs.length > 0 ? totalAcc / completedJobs.length : 0;

    const active = jobs.filter(j => j.status === "running" || j.status === "pending").length;
    const totalRowsMapped = completedJobs.reduce((sum, j) => sum + j.total_rows, 0);

    return { total, avgAccuracy, active, totalRowsMapped };
  }, [jobs]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Drug Matcher <span className="text-primary">Campaigns</span>
          </h1>
          <p className="mt-2 text-zinc-500 font-medium">
            Manage pharmacy inventory mapping campaigns, view historical stats, and export sheets.
          </p>
        </div>
        <Link
          href="/dashboard/matcher/new"
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" />
          New Match
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Campaigns */}
        <div className="p-6 rounded-2xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm backdrop-blur-md flex items-center gap-5">
          <div className="p-4 bg-primary/10 rounded-xl text-primary">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total Campaigns</p>
            <p className="text-2xl font-black text-zinc-800 dark:text-zinc-150 mt-1">{stats.total}</p>
          </div>
        </div>

        {/* Avg Accuracy */}
        <div className="p-6 rounded-2xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm backdrop-blur-md flex items-center gap-5">
          <div className="p-4 bg-success/10 rounded-xl text-success">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Average Accuracy</p>
            <p className="text-2xl font-black text-success mt-1">{stats.avgAccuracy.toFixed(1)}%</p>
          </div>
        </div>

        {/* Active Runs */}
        <div className="p-6 rounded-2xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm backdrop-blur-md flex items-center gap-5">
          <div className="p-4 bg-info/10 rounded-xl text-info">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Active Tasks</p>
            <p className="text-2xl font-black text-info mt-1">{stats.active}</p>
          </div>
        </div>

        {/* Total Processed Rows */}
        <div className="p-6 rounded-2xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm backdrop-blur-md flex items-center gap-5">
          <div className="p-4 bg-warning/10 rounded-xl text-warning">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total Rows Mapped</p>
            <p className="text-2xl font-black text-zinc-800 dark:text-zinc-150 mt-1">{stats.totalRowsMapped.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Primary History Grid Card */}
      <div className="p-6 rounded-2xl bg-white/40 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm backdrop-blur-md space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/55 pb-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search campaigns by filename or mapped column..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
            />
          </div>
          <p className="text-xs text-zinc-400 font-semibold">
            Showing {filteredJobs.length} campaigns
          </p>
        </div>

        {/* Campaign logs table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm text-zinc-400 font-medium">Fetching history logs from server...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <FileSpreadsheet className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto" />
            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-250">No campaigns found</h3>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              Ready to map your first pharmacy sheet? Click "New Match" above to start the wizard.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200/50 dark:border-zinc-800/60">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-200/50 dark:border-zinc-800/60">
                  <th className="p-4">Filename</th>
                  <th className="p-4">Mapped Column</th>
                  <th className="p-4">Total Rows</th>
                  <th className="p-4">Matches / Rate</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Uploaded At</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/40 dark:divide-zinc-800/60">
                {filteredJobs.map((job) => {
                  const isRunning = job.status === "running" || job.status === "pending";
                  const isSuccess = job.status === "completed";
                  const isFailed = job.status === "failed";
                  const isStopped = job.status === "stopped";

                  const accuracy = job.total_rows > 0 ? (job.matched_count / job.total_rows) * 100 : 0;

                  return (
                    <tr key={job.job_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 transition-colors group">
                      {/* Filename */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2.5 rounded-lg border",
                            isSuccess && "bg-success/10 text-success border-success/20",
                            isRunning && "bg-primary/10 text-primary border-primary/20",
                            isFailed && "bg-error/10 text-error border-error/20",
                            isStopped && "bg-zinc-100 dark:bg-zinc-800 text-zinc-550 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                          )}>
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-zinc-800 dark:text-zinc-150 truncate max-w-[200px]" title={job.filename}>
                              {job.filename}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-medium">ID: {job.job_id.substring(0, 8)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Mapped Column */}
                      <td className="p-4 font-semibold text-zinc-600 dark:text-zinc-350">
                        {job.column_used || "Auto-detect"}
                      </td>

                      {/* Total Rows */}
                      <td className="p-4 font-bold text-zinc-700 dark:text-zinc-300">
                        {job.total_rows.toLocaleString()}
                      </td>

                      {/* Matches / Accuracy */}
                      <td className="p-4">
                        {isFailed || isStopped ? (
                          <span className="text-zinc-400">—</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-100">
                              <span>{job.matched_count}</span>
                              <span className="text-[10px] text-zinc-400 font-semibold">({accuracy.toFixed(0)}%)</span>
                            </div>
                            {/* Tiny progress visual */}
                            <div className="w-20 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-success transition-all duration-500"
                                style={{ width: `${accuracy}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5",
                          isRunning && "bg-primary/10 text-primary border border-primary/20 animate-pulse",
                          isSuccess && "bg-success/10 text-success border border-success/20",
                          isFailed && "bg-error/10 text-error border border-error/20",
                          isStopped && "bg-zinc-100 dark:bg-zinc-800 text-zinc-550 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                        )}>
                          {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
                          {isSuccess && <CheckCircle className="w-3 h-3 text-success" />}
                          {isFailed && <AlertCircle className="w-3 h-3 text-error" />}
                          {isStopped && <Clock className="w-3 h-3 text-zinc-400" />}
                          {job.status}
                        </span>
                      </td>

                      {/* Uploaded At */}
                      <td className="p-4 text-xs font-semibold text-zinc-500">
                        {new Date(job.created_at).toLocaleDateString()} at {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Inspect Results */}
                          <Link
                            href={`/dashboard/matcher/new?job_id=${job.job_id}`}
                            className="p-2 cursor-pointer rounded-lg bg-zinc-850 hover:bg-primary hover:text-white text-zinc-600 dark:text-zinc-300 transition-all"
                            title="Inspect & Override Results"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>

                          {/* Export Compiled Excel */}
                          {isSuccess && (
                            <button
                              onClick={() => handleExportClick(job.job_id)}
                              disabled={exportingJobId !== null}
                              className="p-2 rounded-lg cursor-pointer bg-zinc-850 hover:bg-success hover:text-white text-zinc-600 dark:text-zinc-300 transition-all disabled:opacity-50 inline-flex items-center justify-center"
                              title="Export Catalog Spreadsheet"
                            >
                              {exportingJobId === job.job_id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-success" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Delete Campaign */}
                          <button
                            onClick={() => {
                              setJobToDelete({ id: job.job_id, filename: job.filename });
                              setIsDeleteOpen(true);
                            }}
                            className="p-2 rounded-lg cursor-pointer bg-zinc-850 hover:bg-error hover:text-white text-zinc-600 dark:text-zinc-300 transition-all inline-flex items-center justify-center"
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => {
          setIsExportDialogOpen(false);
          setActiveJobId(null);
        }}
        jobId={activeJobId}
        initialResults={selectedJobResults}
      />

      {/* Delete Campaign Modal */}
      <DeleteCampaignModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setJobToDelete(null);
        }}
        jobId={jobToDelete?.id || null}
        filename={jobToDelete?.filename || ""}
        onDeleted={fetchJobs}
      />
    </div>
  );
}
