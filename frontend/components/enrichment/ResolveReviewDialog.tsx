"use client";

import React from "react";
import { AlertTriangle, Check, Loader2, SkipForward, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export interface ResolveRowPreview {
  row_index: number;
  original_name: string;
  sheet_barcode?: string | null;
  sheet_code?: string | null;
  db_product_id?: string | null;
  db_name_en?: string | null;
  db_international_barcode?: string | null;
  review_reason?: string | null;
  score?: number;
}

interface ResolveReviewDialogProps {
  isOpen: boolean;
  action: "override" | "skip" | null;
  row: ResolveRowPreview | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function reasonLabel(reason?: string | null) {
  if (reason === "barcode_conflict") return "DB already has a different barcode";
  if (reason === "low_confidence") return "Low confidence match";
  if (reason === "missing_sheet_barcode") return "Missing sheet barcode";
  return reason || "Needs review";
}

export function ResolveReviewDialog({
  isOpen,
  action,
  row,
  isSubmitting,
  onClose,
  onConfirm,
}: ResolveReviewDialogProps) {
  if (!action || !row) return null;

  const isOverride = action === "override";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isSubmitting ? undefined : onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  {isOverride ? "Confirm override" : "Confirm skip"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Row {row.row_index + 1} · {reasonLabel(row.review_reason)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
                <div className="grid gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Sheet product
                    </p>
                    <p className="mt-0.5 font-medium">{row.original_name || "—"}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      barcode: {row.sheet_barcode || "—"}
                      {row.sheet_code ? ` · code: ${row.sheet_code}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Matched DB product
                    </p>
                    <p className="mt-0.5 font-medium">{row.db_name_en || "—"}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      id: {row.db_product_id || "—"} · current barcode:{" "}
                      {row.db_international_barcode || "empty"}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={
                  isOverride
                    ? "rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
                    : "rounded-2xl border border-border bg-muted/40 px-4 py-3"
                }
              >
                <div className="flex gap-3">
                  <AlertTriangle
                    className={
                      isOverride
                        ? "mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                        : "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    }
                  />
                  <div className="space-y-1 text-sm">
                    {isOverride ? (
                      <>
                        <p className="font-semibold text-amber-900 dark:text-amber-100">
                          Override writes to the live catalog
                        </p>
                        <p className="text-amber-800/90 dark:text-amber-100/80">
                          The sheet barcode
                          {row.sheet_code ? " (and code)" : ""} will replace what is currently on this
                          DB product. Confirm only if you verified this match is correct.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-foreground">Skip leaves the catalog unchanged</p>
                        <p className="text-muted-foreground">
                          This row will be marked skipped. No barcode or code will be written to the
                          DB product.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                By confirming, you accept responsibility for this decision.
              </p>
              <div className="flex gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  onClick={onConfirm}
                  disabled={isSubmitting}
                  className={
                    isOverride
                      ? "gap-2 rounded-full bg-amber-600 hover:bg-amber-700"
                      : "gap-2 rounded-full"
                  }
                  variant={isOverride ? "default" : "secondary"}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isOverride ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <SkipForward className="h-4 w-4" />
                  )}
                  {isOverride ? "Confirm override" : "Confirm skip"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
