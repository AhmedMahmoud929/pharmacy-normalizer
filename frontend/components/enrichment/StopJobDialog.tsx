"use client";

import React from "react";
import { AlertTriangle, Loader2, Square, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface StopJobDialogProps {
  isOpen: boolean;
  isStopping: boolean;
  processed?: number;
  total?: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function StopJobDialog({
  isOpen,
  isStopping,
  processed = 0,
  total = 0,
  onClose,
  onConfirm,
}: StopJobDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isStopping ? undefined : onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Stop matching job?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {total > 0
                    ? `Processed ${processed.toLocaleString()} of ${total.toLocaleString()} rows so far.`
                    : "This will cancel the running enrichment job."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isStopping}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-error">Matching will stop immediately</p>
                    <ul className="list-disc space-y-1 ps-4 text-error/90">
                      <li>Rows already processed stay available for review.</li>
                      <li>Unprocessed rows will not be matched in this job.</li>
                      <li>You can still apply matched / resolve review on the partial results.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isStopping}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={isStopping}
                className="gap-2 rounded-full border border-error/30 bg-error/15 text-error hover:bg-error/25 hover:text-error"
                variant="outline"
              >
                {isStopping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-3.5 w-3.5 fill-current" />
                )}
                Confirm stop
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
