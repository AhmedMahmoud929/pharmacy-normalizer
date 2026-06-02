"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Loader2, X, ChevronDown, Square, Download, Check, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

// Sub-components
import { UploadZone } from "./matcher/UploadZone";
import { MatchConfig } from "./matcher/MatchConfig";
import { MatchStats } from "./matcher/MatchStats";
import { ProgressSection } from "./matcher/ProgressSection";
import { ResultsTable } from "./matcher/ResultsTable";
import { ComparisonDialog } from "./ComparisonDialog";
import { ManualMatchModal } from "./ManualMatchModal";
import { ExportDialog } from "./matcher/ExportDialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Types ---
interface MatchCandidate {
  score: number;
  status: "matched" | "review" | "no_match";
  id: string;
  sku: string;
  name_en: string;
  price?: number;
  variant_id?: string;
  image?: string;
  product_data?: any;
  variant_data?: any;
  db_normalized?: string;
  jaccard?: number;
  sequence?: number;
  matched_tokens?: string[];
  unmatched_query_tokens?: string[];
  unmatched_db_tokens?: string[];
  candidate_count?: number;
}

interface MatchResult {
  row_index: number;
  original_name: string;
  normalized_name: string;
  matches: MatchCandidate[];
}

interface ProgressState {
  current: number;
  total: number;
}

export default function DrugMatcher() {
  // --- State ---
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ current: 0, total: 0 });
  const [results, setResults] = useState<MatchResult[]>([]);

  // Background & History states
  const [background, setBackground] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Thresholds
  const [matchThreshold, setMatchThreshold] = useState(70);
  const [reviewThreshold, setReviewThreshold] = useState(40);

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Modals
  const [selectedRowForDetails, setSelectedRowForDetails] = useState<MatchResult | null>(null);
  const [selectedRowForManual, setSelectedRowForManual] = useState<MatchResult | null>(null);

  // Performance
  const [parallel, setParallel] = useState(true);
  const [workers, setWorkers] = useState(4);

  const searchParams = useSearchParams();
  const queryJobId = searchParams.get("job_id");

  useEffect(() => {
    if (queryJobId) {
      const fetchAndSelectJob = async () => {
        try {
          const res = await fetch(`${API_URL}/api/matcher/job/${queryJobId}`);
          if (res.ok) {
            const jobData = await res.json();
            selectJob(jobData);
          }
        } catch (err) {
          console.error("Failed to rehydrate job from URL query parameter:", err);
        }
      };
      fetchAndSelectJob();
    }
  }, [queryJobId]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Handlers ---
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary', sheetRows: 5 });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length > 0) {
        const headers = data[0] as string[];
        setColumns(headers);
        const candidates = ["name", "product", "item", "الاسم", "drug"];
        const found = headers.find(h =>
          candidates.some(c => h.toLowerCase().includes(c.toLowerCase()))
        );
        if (found) setSelectedColumn(found);
        else setSelectedColumn(headers[0]);
      }
    };
    reader.readAsBinaryString(selectedFile);
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_URL}/api/matcher/jobs?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setHistoryJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to fetch matching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const selectJob = async (job: any) => {
    setActiveJobId(job.job_id);
    setShowHistory(false);
    setFile(new File([], job.filename)); // Set a placeholder File so MatchConfig doesn't close
    setSelectedColumn(job.column_used || "Unknown");
    setMatchThreshold(Math.round((job.match_threshold || 0.6) * 100));
    setReviewThreshold(Math.round((job.review_threshold || 0.4) * 100));

    if (job.status === "completed") {
      setIsProcessing(false);
      setIsComplete(true);
      setResults([]);
      
      // Fetch full results
      try {
        const response = await fetch(`${API_URL}/api/matcher/job/${job.job_id}/results?limit=10000`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
        }
      } catch (err) {
        console.error("Failed to fetch job results:", err);
      }
    } else if (job.status === "running" || job.status === "pending") {
      setIsProcessing(true);
      setIsComplete(false);
      setResults([]);
      setProgress({ current: job.processed_rows || 0, total: job.total_rows || 100 });
      
      // Subscribe to real-time streaming progress SSE channel
      const eventSource = new EventSource(`${API_URL}/api/matcher/job/${job.job_id}/stream`);
      
      eventSource.addEventListener("info", (e) => {
        const data = JSON.parse(e.data);
        setProgress(prev => ({ ...prev, total: data.total_rows }));
      });

      eventSource.addEventListener("progress", (e) => {
        const data = JSON.parse(e.data);
        setProgress({
          current: data.processed_rows,
          total: data.total_rows
        });
      });

      eventSource.addEventListener("result", (e) => {
        const payload = JSON.parse(e.data) as MatchResult;
        setResults(prev => {
          if (prev.some(r => r.row_index === payload.row_index)) return prev;
          return [payload, ...prev];
        });
      });

      eventSource.addEventListener("complete", (e) => {
        setIsProcessing(false);
        setIsComplete(true);
        eventSource.close();
        fetch(`${API_URL}/api/matcher/job/${job.job_id}/results?limit=10000`)
          .then(res => res.json())
          .then(data => setResults(data.results || []));
      });

      eventSource.addEventListener("error", (e) => {
        console.error("SSE stream error:", e);
        setIsProcessing(false);
        eventSource.close();
      });
    } else {
      setIsProcessing(false);
      setIsComplete(true);
      alert(`Job has state: ${job.status}. Error: ${job.error_msg || "None"}`);
    }
  };

  const reset = () => {
    setFile(null);
    setResults([]);
    setIsComplete(false);
    setProgress({ current: 0, total: 0 });
    setCurrentPage(1);
    setActiveJobId(null);
  };

  const stopMatching = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
  };

  const startMatching = async () => {
    if (!file || !selectedColumn) return;

    setIsProcessing(true);
    setIsComplete(false);
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setActiveJobId(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("column", selectedColumn);
    formData.append("match_threshold", (matchThreshold / 100).toString());
    formData.append("review_threshold", (reviewThreshold / 100).toString());
    formData.append("parallel", parallel.toString());
    if (parallel) formData.append("workers", workers.toString());
    formData.append("background", background.toString());

    try {
      const response = await fetch(`${API_URL}/api/matcher/run`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });

      if (background) {
        if (response.ok) {
          const data = await response.json();
          setActiveJobId(data.job_id);
          setIsProcessing(false);
          alert(`Matching started asynchronously in the background!\nJob ID: ${data.job_id}\nYou can safely navigate away and monitor progress in the 'History Logs'.`);
          fetchHistory();
        } else {
          throw new Error("Failed to queue background match job");
        }
        return;
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: info")) {
            const data = JSON.parse(line.split("data: ")[1]);
            setProgress({ current: 0, total: data.total_rows });
            if (data.job_id) {
              setActiveJobId(data.job_id);
            }
          } else if (line.startsWith("event: result")) {
            const payload = JSON.parse(line.split("data: ")[1]) as MatchResult;
            setResults(prev => {
              if (prev.some(r => r.row_index === payload.row_index)) return prev;
              return [payload, ...prev];
            });
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
          } else if (line.startsWith("event: complete")) {
            setIsProcessing(false);
            setIsComplete(true);
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        alert("An error occurred during matching.");
      }
    } finally {
      if (!background) {
        setIsProcessing(false);
      }
    }
  };

  const handleApprove = async (rowIndex: number) => {
    const resRow = results.find(r => r.row_index === rowIndex);
    if (!resRow || resRow.matches.length === 0) return;
    const topMatch = resRow.matches[0];

    // Optimistic UI update
    setResults(prev => prev.map(res => {
      if (res.row_index === rowIndex && res.matches.length > 0) {
        const updatedMatches = [...res.matches];
        updatedMatches[0] = { ...updatedMatches[0], status: 'matched' };
        return { ...res, matches: updatedMatches };
      }
      return res;
    }));

    if (activeJobId) {
      try {
        await fetch(`${API_URL}/api/matcher/job/${activeJobId}/override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            row_index: rowIndex,
            matched_sku: topMatch.sku,
            product_id: topMatch.id
          })
        });
      } catch (err) {
        console.error("Failed to sync override to server:", err);
      }
    }
  };

  const handleReject = async (rowIndex: number) => {
    const resRow = results.find(r => r.row_index === rowIndex);
    if (!resRow || resRow.matches.length === 0) return;
    const topMatch = resRow.matches[0];

    // Optimistic UI update
    setResults(prev => prev.map(res => {
      if (res.row_index === rowIndex && res.matches.length > 0) {
        const updatedMatches = [...res.matches];
        updatedMatches[0] = { ...updatedMatches[0], status: 'no_match' };
        return { ...res, matches: updatedMatches };
      }
      return res;
    }));

    if (activeJobId) {
      try {
        await fetch(`${API_URL}/api/matcher/job/${activeJobId}/override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            row_index: rowIndex,
            matched_sku: topMatch.sku,
            product_id: topMatch.id
          })
        });
      } catch (err) {
        console.error("Failed to sync override to server:", err);
      }
    }
  };

  const handleManualSelection = async (product: any, variant: any) => {
    if (!selectedRowForManual) return;
    const rowIndex = selectedRowForManual.row_index;

    const newMatch: MatchCandidate = {
      id: product.id.toString(),
      sku: variant.sku,
      name_en: product.name_en,
      score: 1.0,
      status: 'matched',
      price: variant.price,
      variant_id: variant.id.toString(),
      product_data: product,
      variant_data: variant
    };

    setResults(prev => prev.map(res => {
      if (res.row_index === rowIndex) {
        return {
          ...res,
          matches: [newMatch, ...res.matches]
        };
      }
      return res;
    }));

    setSelectedRowForManual(null);

    if (activeJobId) {
      try {
        await fetch(`${API_URL}/api/matcher/job/${activeJobId}/override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            row_index: rowIndex,
            matched_sku: variant.sku,
            product_id: product.id.toString()
          })
        });
      } catch (err) {
        console.error("Failed to sync override to server:", err);
      }
    }
  };

  // --- Logic ---
  const sortedAndFilteredResults = useMemo(() => {
    let filtered = results;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(res =>
        res.original_name.toLowerCase().includes(q) ||
        res.matches.some(m => m.name_en.toLowerCase().includes(q)) ||
        res.matches.some(m => m.status.toLowerCase().includes(q))
      );
    }

    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'score') {
          aValue = a.matches[0]?.score || 0;
          bValue = b.matches[0]?.score || 0;
        } else if (sortConfig.key === 'status') {
          aValue = a.matches[0]?.status || '';
          bValue = b.matches[0]?.status || '';
        } else {
          aValue = (a as any)[sortConfig.key];
          bValue = (b as any)[sortConfig.key];
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [results, searchQuery, sortConfig]);

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedAndFilteredResults.slice(start, start + itemsPerPage);
  }, [sortedAndFilteredResults, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedAndFilteredResults.length / itemsPerPage);

  const stats = useMemo(() => {
    const total = results.length;
    const matched = results.filter(r => r.matches[0]?.status === "matched").length;
    const review = results.filter(r => r.matches[0]?.status === "review").length;
    const noMatch = total - matched - review;
    const accuracy = total > 0 ? (matched / total) * 100 : 0;

    return { total, matched, review, noMatch, accuracy };
  }, [results]);

  const requestSort = (key: any) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Drug <span className="text-primary">Matcher</span>
          </h1>
          <p className="mt-2 text-zinc-500 font-medium">
            High-performance real-time pharmacy catalog mapping.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setShowHistory(true);
              fetchHistory();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-600 dark:text-zinc-300 font-bold text-sm transition-all"
            title="View History Logs"
          >
            <Clock className="w-4 h-4 text-primary" />
            History Logs
          </button>

          {isProcessing && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-sm font-bold text-primary">Processing Stream...</span>
              </div>
              <button
                onClick={stopMatching}
                className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error hover:bg-error/20 rounded-full border border-error/20 transition-all font-bold text-sm"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop Matching
              </button>
            </div>
          )}

          {(isComplete || (results.length > 0 && !isProcessing)) && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsExportDialogOpen(true)}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white hover:bg-primary/90 rounded-full transition-all font-bold shadow-lg shadow-primary/20"
                title="Export Results"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>

              {(isComplete || activeJobId) && (
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-white hover:bg-primary-dark rounded-full transition-all font-bold shadow-lg shadow-primary/20"
                >
                  <X className="w-4 h-4" />
                  New Match
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <MatchStats stats={stats} isComplete={isComplete} />

      <div className={cn(
        "grid gap-8 transition-all duration-500 flex-1 w-full grid-cols-1"
      )}>
        {/* Left Column: Config & Upload */}
        <AnimatePresence>
          {(!isProcessing && !isComplete && results.length === 0) && (
            <motion.div
              initial={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100, width: 0, marginRight: 0 }}
              className="space-y-6 w-full overflow-hidden"
            >
              <UploadZone file={file} onFileChange={handleFileChange} />

              <MatchConfig
                file={file}
                columns={columns}
                selectedColumn={selectedColumn}
                setSelectedColumn={setSelectedColumn}
                matchThreshold={matchThreshold}
                setMatchThreshold={setMatchThreshold}
                reviewThreshold={reviewThreshold}
                setReviewThreshold={setReviewThreshold}
                parallel={parallel}
                setParallel={setParallel}
                workers={workers}
                setWorkers={setWorkers}
                isProcessing={isProcessing}
                onStart={startMatching}
                background={background}
                setBackground={setBackground}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Column: Progress & Table */}
        {(isProcessing || isComplete || results.length > 0) && (
          <div className="space-y-6">
            <ProgressSection progress={progress} isProcessing={isProcessing} />

            <ResultsTable
              results={results}
              sortedAndFilteredResults={paginatedResults}
              totalItems={sortedAndFilteredResults.length}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              searchQuery={searchQuery}
              setSearchQuery={(q) => {
                setSearchQuery(q);
                setCurrentPage(1);
              }}
              sortConfig={sortConfig}
              requestSort={requestSort}
              handleApprove={handleApprove}
              handleReject={handleReject}
              onManualSelect={setSelectedRowForManual}
              onViewDetails={setSelectedRowForDetails}
            />
          </div>
        )}
      </div>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 z-[80] bg-zinc-950/60 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 z-[90] w-full max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Match Job History</h2>
                  <p className="text-xs text-zinc-400 mt-1">Review past and ongoing sheets matches</p>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 rounded-full hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : historyJobs.length === 0 ? (
                <div className="text-center py-20 text-zinc-400 font-medium">
                  No matching jobs found in history.
                </div>
              ) : (
                <div className="space-y-4">
                  {historyJobs.map((job) => {
                    const isRunning = job.status === "running" || job.status === "pending";
                    const isSuccess = job.status === "completed";
                    const isFailed = job.status === "failed";
                    
                    return (
                      <button
                        key={job.job_id}
                        onClick={() => selectJob(job)}
                        className="w-full p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 text-left hover:border-primary/50 hover:bg-primary/5 transition-all space-y-3 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            isRunning && "bg-primary/10 text-primary border border-primary/20",
                            isSuccess && "bg-success/10 text-success border border-success/20",
                            isFailed && "bg-error/10 text-error border border-error/20"
                          )}>
                            {job.status}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-semibold">
                            {new Date(job.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div>
                          <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100 truncate group-hover:text-primary transition-colors">
                            {job.filename}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Mapped Column: <span className="font-semibold text-zinc-500">{job.column_used || "Auto"}</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500 font-semibold border-t border-zinc-100 dark:border-zinc-800/80 pt-2">
                          <div>
                            <p className="text-zinc-400 font-normal">Total Rows</p>
                            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{job.total_rows}</p>
                          </div>
                          <div>
                            <p className="text-zinc-400 font-normal">Matched</p>
                            <p className="text-sm font-bold text-success mt-0.5">{job.matched_count}</p>
                          </div>
                          <div>
                            <p className="text-zinc-400 font-normal">Review</p>
                            <p className="text-sm font-bold text-warning mt-0.5">{job.review_count}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Details Dialog */}
      <ComparisonDialog
        isOpen={selectedRowForDetails !== null}
        onClose={() => setSelectedRowForDetails(null)}
        data={selectedRowForDetails}
      />

      {/* Manual Selection Modal */}
      <ManualMatchModal
        isOpen={selectedRowForManual !== null}
        onClose={() => setSelectedRowForManual(null)}
        originalName={selectedRowForManual?.original_name || ""}
        onSelect={handleManualSelection}
      />

      {/* Export Dialog */}
      <ExportDialog 
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        results={results}
      />
    </div>
  );
}
