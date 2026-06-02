"use client";

import { useToast } from "./use-toast";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex w-full max-w-sm flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          if (!toast.open) return null;

          const isSuccess = toast.type === "success";
          const isError = toast.type === "error";
          const isInfo = toast.type === "info";

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className={cn(
                "w-full pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-lg transition-colors duration-300",
                "bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-50 border-zinc-200 dark:border-zinc-800",
                isSuccess && "bg-success/5 dark:bg-success/10 border-success/30 dark:border-success/20",
                isError && "bg-error/5 dark:bg-error/10 border-error/30 dark:border-error/20",
                isInfo && "bg-primary/5 dark:bg-primary/10 border-primary/30 dark:border-primary/20"
              )}
            >
              {/* Type Icons */}
              <div className={cn(
                "mt-0.5 text-zinc-500",
                isSuccess && "text-success",
                isError && "text-error",
                isInfo && "text-primary"
              )}>
                {isSuccess && <CheckCircle className="w-5 h-5" />}
                {isError && <AlertCircle className="w-5 h-5" />}
                {isInfo && <Info className="w-5 h-5" />}
                {!isSuccess && !isError && !isInfo && <Info className="w-5 h-5" />}
              </div>

              {/* Text Context */}
              <div className="flex-1 space-y-1">
                {toast.title && (
                  <h4 className="font-bold text-sm leading-tight text-zinc-800 dark:text-zinc-100">
                    {toast.title}
                  </h4>
                )}
                {toast.description && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                    {toast.description}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => dismiss(toast.id)}
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
