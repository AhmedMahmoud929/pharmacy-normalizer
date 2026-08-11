"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { API_URL, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface PendingMatchRow {
  row_index: number;
  original_name: string;
  sheet_barcode?: string | null;
  sheet_code?: string | null;
  db_product_id?: string | null;
  db_name_en?: string | null;
  db_international_barcode?: string | null;
  score?: number;
}

interface ApplyMatchedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  pendingCount: number;
  isApplying: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ApplyMatchedDialog({
  isOpen,
  onClose,
  jobId,
  pendingCount,
  isApplying,
  onConfirm,
}: ApplyMatchedDialogProps) {
  const [rows, setRows] = useState<PendingMatchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !jobId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          status: "matched",
          apply_status: "pending",
          limit: "100",
          offset: "0",
        });
        const res = await fetch(`${API_URL}/api/enrichment/job/${jobId}/results?${params}`);
        if (!res.ok) throw new Error("Failed to load matched rows");
        const data = await res.json();
        if (cancelled) return;
        const pending = (data.results || []).filter((row: PendingMatchRow) => {
          const sheet = String(row.sheet_barcode || "").trim().replace(/\.0$/, "");
          const db = String(row.db_international_barcode || "").trim().replace(/\.0$/, "");
          // Hide rows that already have the same barcode — nothing to write
          return !db || db !== sheet;
        });
        setRows(pending);
        // Prefer filtered count when preview page contains same-barcode rows
        const apiTotal = data.total ?? pendingCount;
        const hiddenSame = (data.results || []).length - pending.length;
        setTotal(Math.max(0, apiTotal - hiddenSame));
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, jobId, pendingCount]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isApplying ? undefined : onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Confirm apply matched
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {total || pendingCount} product
                  {(total || pendingCount) === 1 ? "" : "s"} will be written to the live catalog.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isApplying}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-6 py-4">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1.5 text-sm text-amber-900 dark:text-amber-100">
                    <p className="font-semibold">You are about to update the live catalog</p>
                    <ul className="list-disc space-y-1 ps-4 text-amber-800/90 dark:text-amber-100/80">
                      <li>
                        Each matched row writes the sheet <strong>international barcode</strong> (and{" "}
                        <strong>code</strong> if present) onto the matched DB product.
                      </li>
                      <li>
                        Only products with an empty (or different) barcode that still need a write are
                        listed. Rows whose sheet barcode already matches the DB are skipped
                        automatically.
                      </li>
                      <li>
                        This cannot be undone from this screen — confirm only if you verified the
                        matches.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading matched rows…
                </div>
              ) : error ? (
                <p className="py-8 text-center text-sm text-error">{error}</p>
              ) : rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No pending matched rows to apply.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border">
                  <div className="max-h-[36vh] overflow-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="sticky top-0 bg-muted/80 text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold">#</th>
                          <th className="px-3 py-2.5 font-semibold">Sheet product</th>
                          <th className="px-3 py-2.5 font-semibold">Barcode → DB</th>
                          <th className="px-3 py-2.5 font-semibold">DB product</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.row_index} className="border-t border-border/50 align-top">
                            <td className="px-3 py-2.5 text-muted-foreground">{row.row_index + 1}</td>
                            <td className="px-3 py-2.5">
                              <div className="font-medium">{row.original_name || "—"}</div>
                              {row.sheet_code && (
                                <div className="text-xs text-muted-foreground">
                                  code: {row.sheet_code}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {row.sheet_barcode || "—"}
                              </span>
                              <span className="mx-1 text-muted-foreground">→</span>
                              <span className="text-muted-foreground">
                                {row.db_international_barcode || "empty"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div>{row.db_name_en || "—"}</div>
                              {row.db_product_id && (
                                <div className="text-xs text-muted-foreground">
                                  id: {row.db_product_id}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {total > rows.length && (
                    <p className="border-t border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      Showing first {rows.length} of {total}. Confirm applies all {total} pending
                      matched rows.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                By confirming, you accept responsibility for these catalog updates.
              </p>
              <div className="flex gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isApplying}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => onConfirm()}
                  disabled={isApplying || loading || (!!error && rows.length === 0) || total === 0}
                  className={cn(
                    "gap-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white",
                    "disabled:opacity-50"
                  )}
                >
                  {isApplying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirm apply ({total || pendingCount})
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
