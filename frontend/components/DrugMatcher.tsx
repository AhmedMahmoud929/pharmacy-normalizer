"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Loader2, X, ChevronDown, Square, Download, Check, Clock, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";

// Sub-components
import { UploadZone } from "./matcher/UploadZone";
import { MatchConfig } from "./matcher/MatchConfig";
import { MatchStats } from "./matcher/MatchStats";
import { ProgressSection } from "./matcher/ProgressSection";
import { ResultsTable } from "./matcher/ResultsTable";
import { ComparisonDialog } from "./ComparisonDialog";
import { ManualMatchModal } from "./ManualMatchModal";
import { ExportDialog } from "./matcher/ExportDialog";
import { MatcherSkeleton } from "./matcher/MatcherSkeleton";

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
  uploaded_price?: number | null;
  uploaded_stock?: number | null;
  uploaded_code?: string | null;
  uploaded_international_barcode?: string | null;
  matching_method?: "international barcode" | "code" | "normalizer";
  matches: MatchCandidate[];
}

interface ProgressState {
  current: number;
  total: number;
}

export default function DrugMatcher() {
  const { toast } = useToast();
  // --- State ---
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ current: 0, total: 0 });
  const [results, setResults] = useState<MatchResult[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [isLoadingJob, setIsLoadingJob] = useState(false);

  // Background & History states
  const [background, setBackground] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [useUploadedPrice, setUseUploadedPrice] = useState(false);
  const [priceColumn, setPriceColumn] = useState("");
  const [useUploadedStock, setUseUploadedStock] = useState(false);
  const [stockColumn, setStockColumn] = useState("");
  const [defaultStock, setDefaultStock] = useState(10);
  const [useUploadedCode, setUseUploadedCode] = useState(false);
  const [codeColumn, setCodeColumn] = useState("");
  const [useUploadedInternationalBarcode, setUseUploadedInternationalBarcode] = useState(false);
  const [internationalBarcodeColumn, setInternationalBarcodeColumn] = useState("");
  const [matchWithInternationalBarcode, setMatchWithInternationalBarcode] = useState(true);
  const [matchInternationalBarcodeColumn, setMatchInternationalBarcodeColumn] = useState("");
  const [matchWithCode, setMatchWithCode] = useState(true);
  const [matchPosCodeColumn, setMatchPosCodeColumn] = useState("");
  const [skipNormalizer, setSkipNormalizer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Thresholds
  const [matchThreshold, setMatchThreshold] = useState(50);
  const [reviewThreshold, setReviewThreshold] = useState(40);

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Server-side pagination (used for completed/failed/stopped jobs)
  const [isServerSide, setIsServerSide] = useState(false);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const [serverStats, setServerStats] = useState<{ total: number; matched: number; review: number; noMatch: number; accuracy: number; duration?: number | null } | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);

  // Live timer states
  const [jobStartTime, setJobStartTime] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);

  // Live timer effect
  useEffect(() => {
    let timerId: any = null;
    if (isProcessing && jobStartTime) {
      const startMs = new Date(jobStartTime).getTime();
      const updateTimer = () => {
        const diffSecs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        setElapsedSeconds(diffSecs);
      };
      updateTimer();
      timerId = setInterval(updateTimer, 1000);
    } else {
      setElapsedSeconds(null);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isProcessing, jobStartTime]);

  // Modals
  const [selectedRowForDetails, setSelectedRowForDetails] = useState<MatchResult | null>(null);
  const [selectedRowForManual, setSelectedRowForManual] = useState<MatchResult | null>(null);

  // Performance
  const [parallel, setParallel] = useState(true);
  const [workers, setWorkers] = useState(4);

  // Debounce ref for server-side search
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchParams = useSearchParams();
  const queryJobId = searchParams.get("job_id");

  useEffect(() => {
    if (queryJobId) {
      const fetchAndSelectJob = async () => {
        setIsLoadingJob(true);
        try {
          const res = await fetch(`${API_URL}/api/matcher/job/${queryJobId}`);
          if (res.ok) {
            const jobData = await res.json();
            await selectJob(jobData);
          } else {
            setIsLoadingJob(false);
          }
        } catch (err) {
          console.error("Failed to rehydrate job from URL query parameter:", err);
          setIsLoadingJob(false);
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
      const wb = XLSX.read(bstr, { type: 'binary', sheetRows: 15 });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length > 0) {
        const headers = data[0] as string[];
        setColumns(headers);

        const rawJson = XLSX.utils.sheet_to_json(ws) as any[];
        setPreviewRows(rawJson.slice(0, 5));

        const candidates = ["name", "product", "item", "الاسم", "drug"];
        const found = headers.find(h =>
          candidates.some(c => h.toLowerCase().includes(c.toLowerCase()))
        );
        if (found) setSelectedColumn(found);
        else setSelectedColumn(headers[0]);

        const priceCandidates = ["price", "سعر", "الافتراضي", "cost", "final_price", "s3r", "price_eg", "default_price"];
        const foundPrice = headers.find(h =>
          priceCandidates.some(c => h.toLowerCase().includes(c.toLowerCase()))
        );
        if (foundPrice) setPriceColumn(foundPrice);
        else setPriceColumn(headers[0] || "");

        const stockCandidates = ["stock", "qty", "quantity", "الكمية", "الرصيد", "current_stock", "avail", "inventory"];
        const foundStock = headers.find(h =>
          stockCandidates.some(c => h.toLowerCase().includes(c.toLowerCase()))
        );
        if (foundStock) setStockColumn(foundStock);
        else setStockColumn(headers[0] || "");

        const codeCandidates = ["code", "product_code", "item_code", "sku_code", "كود", "رمز"];
        const foundCode = headers.find(h =>
          codeCandidates.some(c => h.toLowerCase().includes(c.toLowerCase()))
        );
        if (foundCode) setCodeColumn(foundCode);
        else setCodeColumn(headers[0] || "");

        const barcodeCandidates = ["barcode", "international_barcode", "ean", "upc", "gtin", "باركود", "الباركود"];
        const foundBarcode = headers.find(h =>
          barcodeCandidates.some(c => h.toLowerCase().includes(c.toLowerCase()))
        );
        if (foundBarcode) setInternationalBarcodeColumn(foundBarcode);
        else setInternationalBarcodeColumn(headers[0] || "");

        if (foundBarcode) setMatchInternationalBarcodeColumn(foundBarcode);
        else setMatchInternationalBarcodeColumn(headers[0] || "");

        if (foundCode) setMatchPosCodeColumn(foundCode);
        else setMatchPosCodeColumn(headers[0] || "");
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

  // Fetch a single page of results from the server (server-side pagination)
  const fetchPageResults = useCallback(async (
    jobId: string,
    page: number,
    perPage: number,
    search: string,
    sort?: { key: string; direction: string } | null
  ) => {
    setIsLoadingPage(true);
    const offset = (page - 1) * perPage;
    const params = new URLSearchParams({
      limit: perPage.toString(),
      offset: offset.toString(),
    });
    if (search) params.set("search", search);
    if (sort) {
      params.set("sort_by", sort.key);
      params.set("sort_dir", sort.direction);
    }
    try {
      const res = await fetch(`${API_URL}/api/matcher/job/${jobId}/results?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setServerTotalItems(data.total ?? 0);
        if (data.stats) setServerStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch page results:", err);
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  const selectJob = async (job: any, autoOpenExport = false) => {
    setIsLoadingJob(true);
    setActiveJobId(job.job_id);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `?job_id=${job.job_id}`);
    }
    setShowHistory(false);
    setFile(new File([], job.filename)); // Set a placeholder File so MatchConfig doesn't close
    setSelectedColumn(job.column_used || "Unknown");
    setMatchThreshold(Math.round((job.match_threshold || 0.6) * 100));
    setReviewThreshold(Math.round((job.review_threshold || 0.4) * 100));
    setUseUploadedPrice(!!job.use_uploaded_price);
    setPriceColumn(job.price_column || "");
    setUseUploadedStock(!!job.use_uploaded_stock);
    setStockColumn(job.stock_column || "");
    setDefaultStock(job.default_stock !== undefined ? job.default_stock : 10);
    setUseUploadedCode(!!job.use_uploaded_code);
    setCodeColumn(job.code_column || "");
    setUseUploadedInternationalBarcode(!!job.use_uploaded_international_barcode);
    setInternationalBarcodeColumn(job.international_barcode_column || "");
    setMatchWithInternationalBarcode(!!job.match_with_international_barcode);
    setMatchInternationalBarcodeColumn(job.match_international_barcode_column || "");
    setMatchWithCode(!!job.match_with_code);
    setMatchPosCodeColumn(job.match_pos_code_column || "");
    setSkipNormalizer(!!job.skip_normalizer);

    try {
      if (job.status === "completed") {
        setIsProcessing(false);
        setIsComplete(true);
        setIsServerSide(true);
        setResults([]);
        setCurrentPage(1);
        setSortConfig(null);
        setSearchQuery("");
        setJobStartTime(null);
        // Stats come from job record — no need to scan 100k results
        setServerStats({
          total: job.total_rows || 0,
          matched: job.matched_count || 0,
          review: job.review_count || 0,
          noMatch: job.no_match_count || 0,
          accuracy: job.total_rows > 0 ? Math.round((job.matched_count / job.total_rows) * 100 * 10) / 10 : 0,
          duration: job.duration
        });
        // Fetch first page only (fast)
        await fetchPageResults(job.job_id, 1, itemsPerPage, "", null);
        if (autoOpenExport) setIsExportDialogOpen(true);

      } else if (job.status === "running" || job.status === "pending") {
        setIsServerSide(false);
        setServerStats(null);
        setIsProcessing(true);
        setIsComplete(false);
        setResults([]);
        setProgress({ current: job.processed_rows || 0, total: job.total_rows || 100 });
        setJobStartTime(job.started_at || job.created_at);

        // Fetch already-processed results (small page only — running job may have partial data)
        try {
          const res = await fetch(`${API_URL}/api/matcher/job/${job.job_id}/results?limit=200&offset=0`);
          if (res.ok) {
            const data = await res.json();
            setResults(data.results || []);
          }
        } catch (err) {
          console.error("Error fetching initial results for running job:", err);
        }

        // Subscribe to real-time streaming progress SSE channel
        const eventSource = new EventSource(`${API_URL}/api/matcher/job/${job.job_id}/stream`);

        eventSource.addEventListener("info", (e) => {
          const data = JSON.parse(e.data);
          setProgress(prev => ({ ...prev, total: data.total_rows }));
        });

        eventSource.addEventListener("progress", (e) => {
          const data = JSON.parse(e.data);
          setProgress({ current: data.processed_rows, total: data.total_rows });
        });

        eventSource.addEventListener("result", (e) => {
          const payload = JSON.parse(e.data) as MatchResult;
          setResults(prev => {
            if (prev.some(r => r.row_index === payload.row_index)) return prev;
            return [payload, ...prev];
          });
        });

        eventSource.addEventListener("complete", () => {
          setIsProcessing(false);
          setIsComplete(true);
          setIsServerSide(true);
          setCurrentPage(1);
          setSortConfig(null);
          setSearchQuery("");
          setJobStartTime(null);
          eventSource.close();
          // Switch to server-side: fetch page 1 + stats
          fetchPageResults(job.job_id, 1, itemsPerPage, "", null).then(() => {
            setIsExportDialogOpen(true);
          });
          // Refresh job record to get final accurate stats
          fetch(`${API_URL}/api/matcher/job/${job.job_id}`)
            .then(r => r.json())
            .then(updatedJob => {
              setServerStats({
                total: updatedJob.total_rows || 0,
                matched: updatedJob.matched_count || 0,
                review: updatedJob.review_count || 0,
                noMatch: updatedJob.no_match_count || 0,
                accuracy: updatedJob.total_rows > 0
                  ? Math.round((updatedJob.matched_count / updatedJob.total_rows) * 100 * 10) / 10
                  : 0,
                duration: updatedJob.duration
              });
            })
            .catch(() => {/* stats fallback from fetchPageResults response is fine */});
        });

        eventSource.addEventListener("error", (e) => {
          console.error("SSE stream error:", e);
          setIsProcessing(false);
          eventSource.close();
        });
      } else {
        // failed / stopped — server-side, first page only
        setIsProcessing(false);
        setIsComplete(false);
        setIsServerSide(true);
        setResults([]);
        setCurrentPage(1);
        setSortConfig(null);
        setSearchQuery("");
        setJobStartTime(null);
        setServerStats({
          total: job.total_rows || 0,
          matched: job.matched_count || 0,
          review: job.review_count || 0,
          noMatch: job.no_match_count || 0,
          accuracy: job.total_rows > 0 ? Math.round((job.matched_count / job.total_rows) * 100 * 10) / 10 : 0,
          duration: job.duration
        });
        await fetchPageResults(job.job_id, 1, itemsPerPage, "", null);

        toast({
          title: `Job ${job.status.toUpperCase()}`,
          description: job.error_msg ? `Status: ${job.error_msg}` : `This campaign was ${job.status}.`,
          type: job.status === "stopped" ? "info" : "error"
        });
      }
    } finally {
      setIsLoadingJob(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResults([]);
    setPreviewRows([]);
    setColumns([]);
    setSelectedColumn("");
    setIsComplete(false);
    setProgress({ current: 0, total: 0 });
    setCurrentPage(1);
    setActiveJobId(null);
    setIsServerSide(false);
    setServerStats(null);
    setServerTotalItems(0);
    setSearchQuery("");
    setSortConfig(null);
    setJobStartTime(null);
    setElapsedSeconds(null);
    setSkipNormalizer(false);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", window.location.pathname);
    }
  };

  const stopMatching = async () => {
    if (activeJobId) {
      try {
        await fetch(`${API_URL}/api/matcher/job/${activeJobId}/stop`, { method: "POST" });
      } catch (err) {
        console.error("Failed to cancel background job:", err);
      }
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
  };

  const startMatching = async () => {
    if (!file || !selectedColumn) return;

    setIsProcessing(true);
    setIsComplete(false);
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setActiveJobId(null);
    setJobStartTime(new Date().toISOString());

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
    formData.append("use_uploaded_price", useUploadedPrice.toString());
    formData.append("price_column", useUploadedPrice ? priceColumn : "");
    formData.append("use_uploaded_stock", useUploadedStock.toString());
    formData.append("stock_column", useUploadedStock ? stockColumn : "");
    formData.append("default_stock", defaultStock.toString());
    formData.append("use_uploaded_code", useUploadedCode.toString());
    formData.append("code_column", useUploadedCode ? codeColumn : "");
    formData.append("use_uploaded_international_barcode", useUploadedInternationalBarcode.toString());
    formData.append("international_barcode_column", useUploadedInternationalBarcode ? internationalBarcodeColumn : "");
    formData.append("match_with_international_barcode", matchWithInternationalBarcode.toString());
    formData.append("match_international_barcode_column", matchWithInternationalBarcode ? matchInternationalBarcodeColumn : "");
    formData.append("match_with_code", matchWithCode.toString());
    formData.append("match_pos_code_column", matchWithCode ? matchPosCodeColumn : "");
    formData.append("skip_normalizer", skipNormalizer.toString());

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
          if (typeof window !== "undefined") {
            window.history.pushState(null, "", `?job_id=${data.job_id}`);
          }
          setIsProcessing(true);
          setProgress({ current: 0, total: data.total_rows || 100 });

          toast({
            title: "Background Job Started",
            description: `Campaign queued successfully. Monitoring live progress...`,
            type: "success"
          });

          fetchHistory();

          // Fetch initial already-processed results so the table is not empty at startup
          fetch(`${API_URL}/api/matcher/job/${data.job_id}/results?limit=100000`)
            .then(res => {
              if (res.ok) return res.json();
              throw new Error("Failed to fetch initial results");
            })
            .then(resData => {
              setResults(resData.results || []);
            })
            .catch(err => {
              console.error("Error fetching initial results for background job:", err);
            });

          // Connect to SSE stream to monitor live progress of background job!
          const eventSource = new EventSource(`${API_URL}/api/matcher/job/${data.job_id}/stream`);

          eventSource.addEventListener("info", (e) => {
            const infoData = JSON.parse(e.data);
            setProgress(prev => ({ ...prev, total: infoData.total_rows }));
          });

          eventSource.addEventListener("progress", (e) => {
            const progressData = JSON.parse(e.data);
            setProgress({
              current: progressData.processed_rows,
              total: progressData.total_rows
            });
          });

          eventSource.addEventListener("result", (e) => {
            const payload = JSON.parse(e.data) as MatchResult;
            setResults(prev => {
              if (prev.some(r => r.row_index === payload.row_index)) return prev;
              return [payload, ...prev];
            });
          });

          eventSource.addEventListener("complete", () => {
            setIsProcessing(false);
            setIsComplete(true);
            setIsServerSide(true);
            setCurrentPage(1);
            setSortConfig(null);
            setSearchQuery("");
            eventSource.close();
            // Switch to server-side: fetch page 1 + stats
            fetchPageResults(data.job_id, 1, itemsPerPage, "", null).then(() => {
              setIsExportDialogOpen(true);
            });
            fetch(`${API_URL}/api/matcher/job/${data.job_id}`)
              .then(r => r.json())
              .then(updatedJob => {
                setServerStats({
                  total: updatedJob.total_rows || 0,
                  matched: updatedJob.matched_count || 0,
                  review: updatedJob.review_count || 0,
                  noMatch: updatedJob.no_match_count || 0,
                  accuracy: updatedJob.total_rows > 0
                    ? Math.round((updatedJob.matched_count / updatedJob.total_rows) * 100 * 10) / 10
                    : 0
                });
              })
              .catch(() => {});
          });

          eventSource.addEventListener("error", (e) => {
            console.error("SSE stream error:", e);
            setIsProcessing(false);
            eventSource.close();
          });
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
        toast({
          title: "Execution Error",
          description: "An error occurred during sheet matching processing.",
          type: "error"
        });
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
  // When server-side: results already holds the current page from the API; skip client processing.
  const sortedAndFilteredResults = useMemo(() => {
    if (isServerSide) return results; // server already filtered, sorted, paginated

    let filtered = results;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(res =>
        res.original_name.toLowerCase().includes(q) ||
        res.matches.some(m => m.name_en.toLowerCase().includes(q)) ||
        res.matches.some(m => m.status.toLowerCase().includes(q)) ||
        (res.matching_method || "").toLowerCase().includes(q)
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
        } else if (sortConfig.key === 'matching_method') {
          aValue = a.matching_method || 'normalizer';
          bValue = b.matching_method || 'normalizer';
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
  }, [results, searchQuery, sortConfig, isServerSide]);

  const paginatedResults = useMemo(() => {
    if (isServerSide) return results; // server already paginated
    const start = (currentPage - 1) * itemsPerPage;
    return sortedAndFilteredResults.slice(start, start + itemsPerPage);
  }, [sortedAndFilteredResults, currentPage, itemsPerPage, isServerSide, results]);

  const totalPages = isServerSide
    ? Math.ceil(serverTotalItems / itemsPerPage)
    : Math.ceil(sortedAndFilteredResults.length / itemsPerPage);

  const displayTotalItems = isServerSide ? serverTotalItems : sortedAndFilteredResults.length;

  // Stats: use pre-computed server stats when available (completed/stopped/failed jobs).
  // For running jobs, compute from local SSE-accumulated results.
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        ...serverStats,
        duration: serverStats.duration ?? elapsedSeconds
      };
    }
    const total = results.length;
    const matched = results.filter(r => r.matches[0]?.status === "matched").length;
    const review = results.filter(r => r.matches[0]?.status === "review").length;
    const noMatch = total - matched - review;
    const accuracy = total > 0 ? (matched / total) * 100 : 0;
    return {
      total,
      matched,
      review,
      noMatch,
      accuracy,
      duration: elapsedSeconds
    };
  }, [results, serverStats, elapsedSeconds]);

  const requestSort = (key: any) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    const newSort = { key, direction };
    setSortConfig(newSort);
    setCurrentPage(1);
    if (isServerSide && activeJobId) {
      fetchPageResults(activeJobId, 1, itemsPerPage, searchQuery, newSort);
    }
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-zinc-200 border-zinc-800 dark:hover:bg-zinc-850 cursor-pointer text-zinc-600 dark:text-zinc-300 font-bold text-sm transition-all"
            title="View History Logs"
          >
            <Clock className="w-4 h-4 text-primary" />
            History Logs
          </button>

          {isProcessing && !isLoadingJob && (
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

          {(isComplete || activeJobId || (results.length > 0 && !isProcessing)) && !isLoadingJob && (
            <div className="flex items-center gap-3">
              {isComplete && (
                <button
                  onClick={() => setIsExportDialogOpen(true)}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-white hover:bg-primary/90 rounded-full transition-all font-bold shadow-lg shadow-primary/20"
                  title="Export Results"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              )}

              {(isComplete || activeJobId) && (
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-white hover:bg-primary-dark rounded-full transition-all font-bold shadow-lg shadow-primary/20"
                >
                  <Plus className="w-4 h-4" />
                  New Match
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary & Table layout or loading skeleton */}
      {isLoadingJob ? (
        <MatcherSkeleton />
      ) : (
        <>
          <MatchStats stats={stats} isComplete={isComplete} isProcessing={isProcessing} />

          <div className={cn(
            "grid gap-8 transition-all duration-500 flex-1 w-full grid-cols-1"
          )}>
            {/* Left Column: Config & Upload */}
            <AnimatePresence>
              {(!isProcessing && !isComplete && results.length === 0) && (
                <motion.div
                  initial={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full overflow-hidden"
                >
                  {!file ? (
                    <div className="max-w-xl mx-auto py-12">
                      <UploadZone file={file} onFileChange={handleFileChange} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
                      {/* Left Column: Configuration Parameters */}
                      <div className="lg:col-span-5 space-y-6">
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
                          useUploadedPrice={useUploadedPrice}
                          setUseUploadedPrice={setUseUploadedPrice}
                          priceColumn={priceColumn}
                          setPriceColumn={setPriceColumn}
                          useUploadedStock={useUploadedStock}
                          setUseUploadedStock={setUseUploadedStock}
                          stockColumn={stockColumn}
                          setStockColumn={setStockColumn}
                          defaultStock={defaultStock}
                          setDefaultStock={setDefaultStock}
                          useUploadedCode={useUploadedCode}
                          setUseUploadedCode={setUseUploadedCode}
                          codeColumn={codeColumn}
                          setCodeColumn={setCodeColumn}
                          useUploadedInternationalBarcode={useUploadedInternationalBarcode}
                          setUseUploadedInternationalBarcode={setUseUploadedInternationalBarcode}
                          internationalBarcodeColumn={internationalBarcodeColumn}
                          setInternationalBarcodeColumn={setInternationalBarcodeColumn}
                          matchWithInternationalBarcode={matchWithInternationalBarcode}
                          setMatchWithInternationalBarcode={setMatchWithInternationalBarcode}
                          matchInternationalBarcodeColumn={matchInternationalBarcodeColumn}
                          setMatchInternationalBarcodeColumn={setMatchInternationalBarcodeColumn}
                          matchWithCode={matchWithCode}
                          setMatchWithCode={setMatchWithCode}
                          matchPosCodeColumn={matchPosCodeColumn}
                          setMatchPosCodeColumn={setMatchPosCodeColumn}
                          skipNormalizer={skipNormalizer}
                          setSkipNormalizer={setSkipNormalizer}
                        />
                      </div>

                      {/* Right Column: Sheet Metadata and Data-Profiling Quick Preview */}
                      <div className="lg:col-span-7 space-y-6">
                        <div className="p-6 rounded-2xl bg-white/50 dark:bg-black/50 backdrop-blur-md border border-primary/50 shadow-sm space-y-6">
                          <div className="flex items-center justify-between border-b border-primary/10 pb-4">
                            <div>
                              <h3 className="text-md font-bold text-foreground truncate max-w-[280px]">
                                {file.name}
                              </h3>
                              <p className="text-xs text-zinc-400 mt-1">
                                {(file.size / 1024).toFixed(1)} KB • {columns.length} columns detected
                              </p>
                            </div>
                            <button
                              onClick={reset}
                              className="px-4 py-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-full transition-all"
                            >
                              Change Sheet
                            </button>
                          </div>

                          <div className="space-y-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
                              Spreadsheet Preview (First 5 Rows)
                            </span>

                            {previewRows.length === 0 ? (
                              <div className="text-center py-8 text-zinc-500 text-sm">
                                Loading spreadsheet preview...
                              </div>
                            ) : (
                              <div className="overflow-x-auto border border-primary/10 rounded-xl max-h-[350px] scrollbar-thin">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-primary/5 text-zinc-400 font-bold uppercase border-b border-primary/10">
                                      {columns.slice(0, 4).map((col, idx) => (
                                        <th key={idx} className="p-3 whitespace-nowrap">
                                          {col}
                                        </th>
                                      ))}
                                      {columns.length > 4 && (
                                        <th className="p-3 text-zinc-500 whitespace-nowrap">
                                          +{columns.length - 4} More
                                        </th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {previewRows.map((row, rowIdx) => (
                                      <tr key={rowIdx} className="border-b border-zinc-100 dark:border-zinc-800/80 last:border-0 hover:bg-primary/5 transition-colors">
                                        {columns.slice(0, 4).map((col, colIdx) => (
                                          <td key={colIdx} className="p-3 text-zinc-600 dark:text-zinc-300 font-medium truncate max-w-[150px]">
                                            {row[col] !== undefined ? String(row[col]) : "---"}
                                          </td>
                                        ))}
                                        {columns.length > 4 && (
                                          <td className="p-3 text-zinc-400 italic">
                                            ...
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Informational Profiler Tip */}
                          <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0 animate-pulse" />
                            <p className="text-[11px] text-zinc-400 leading-relaxed font-semibold">
                              <span className="text-primary font-bold">Data Profile Tip:</span> Ensure that you map the correct column key for pharmaceutical brand names on the left dashboard to get the highest fuzzy string sequence scores.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Right Column: Progress & Table */}
            {(isProcessing || isComplete || results.length > 0 || isServerSide) && (
              <div className="space-y-6">
                <ProgressSection progress={progress} isProcessing={isProcessing} />

                <ResultsTable
                  results={results}
                  sortedAndFilteredResults={paginatedResults}
                  totalItems={displayTotalItems}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => {
                    setCurrentPage(page);
                    if (isServerSide && activeJobId) {
                      fetchPageResults(activeJobId, page, itemsPerPage, searchQuery, sortConfig);
                    }
                  }}
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={(val) => {
                    setItemsPerPage(val);
                    setCurrentPage(1);
                    if (isServerSide && activeJobId) {
                      fetchPageResults(activeJobId, 1, val, searchQuery, sortConfig);
                    }
                  }}
                  searchQuery={searchQuery}
                  setSearchQuery={(q) => {
                    setSearchQuery(q);
                    setCurrentPage(1);
                    if (isServerSide && activeJobId) {
                      // Debounce 350ms to avoid hammering the API on every keystroke
                      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                      searchDebounceRef.current = setTimeout(() => {
                        fetchPageResults(activeJobId, 1, itemsPerPage, q, sortConfig);
                      }, 350);
                    }
                  }}
                  sortConfig={sortConfig}
                  requestSort={requestSort}
                  handleApprove={handleApprove}
                  handleReject={handleReject}
                  onManualSelect={setSelectedRowForManual}
                  onViewDetails={setSelectedRowForDetails}
                  isLoadingPage={isLoadingPage}
                />
              </div>
            )}

          </div>
        </>
      )}

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
              className="fixed inset-0 z-[9999] w-screen h-screen bg-zinc-950/60 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 z-[10000] w-full max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-y-auto"
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
                <div className="space-y-4 pb-6">
                  {historyJobs.slice(0, 3).map((job) => {
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
                            isFailed && "bg-error/10 text-error border border-error/20",
                            job.status === "stopped" && "bg-zinc-150 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
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

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <Link
                      href="/dashboard/matcher"
                      onClick={() => setShowHistory(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-bold text-sm transition-all"
                    >
                      Show All Campaigns
                    </Link>
                  </div>
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
        jobId={activeJobId}
        jobStats={stats}
      />
    </div>
  );
}
