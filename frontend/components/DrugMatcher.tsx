"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Loader2, X, ChevronDown, Square, Download, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

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

  const reset = () => {
    setFile(null);
    setResults([]);
    setIsComplete(false);
    setProgress({ current: 0, total: 0 });
    setCurrentPage(1);
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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("column", selectedColumn);
    formData.append("match_threshold", (matchThreshold / 100).toString());
    formData.append("review_threshold", (reviewThreshold / 100).toString());
    formData.append("parallel", parallel.toString());
    if (parallel) formData.append("workers", workers.toString());

    try {
      const response = await fetch(`${API_URL}/match/sheet`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });

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
          } else if (line.startsWith("event: result")) {
            const payload = JSON.parse(line.split("data: ")[1]) as MatchResult;
            setResults(prev => [payload, ...prev]);
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
      setIsProcessing(false);
    }
  };

  const handleApprove = (rowIndex: number) => {
    setResults(prev => prev.map(res => {
      if (res.row_index === rowIndex && res.matches.length > 0) {
        const updatedMatches = [...res.matches];
        updatedMatches[0] = { ...updatedMatches[0], status: 'matched' };
        return { ...res, matches: updatedMatches };
      }
      return res;
    }));
  };

  const handleReject = (rowIndex: number) => {
    setResults(prev => prev.map(res => {
      if (res.row_index === rowIndex && res.matches.length > 0) {
        const updatedMatches = [...res.matches];
        updatedMatches[0] = { ...updatedMatches[0], status: 'no_match' };
        return { ...res, matches: updatedMatches };
      }
      return res;
    }));
  };

  const handleManualSelection = (product: any, variant: any) => {
    if (!selectedRowForManual) return;

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
      if (res.row_index === selectedRowForManual.row_index) {
        return {
          ...res,
          matches: [newMatch, ...res.matches]
        };
      }
      return res;
    }));

    setSelectedRowForManual(null);
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

              {isComplete && (
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
          {(!isProcessing && !isComplete) && (
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
