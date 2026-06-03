"use client";

import React, { useState } from "react";
import { X, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/lib/utils";

interface DeleteCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  filename: string;
  onDeleted: () => void;
}

export const DeleteCampaignModal: React.FC<DeleteCampaignModalProps> = ({
  isOpen,
  onClose,
  jobId,
  filename,
  onDeleted,
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/matcher/job/${jobId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        onDeleted();
        setPassword("");
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Incorrect password or deletion failed.");
      }
    } catch (err) {
      setError("Failed to connect to the server.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && jobId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-150 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-error">
                <span className="p-2 bg-error/10 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-error animate-pulse" />
                </span>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Delete Campaign
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleDelete} className="p-6 space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-655 dark:text-zinc-300">
                  Are you sure you want to delete the mapping campaign:
                </p>
                <div className="p-3.5 bg-zinc-50 dark:bg-black/35 rounded-xl border border-zinc-200/60 dark:border-zinc-800/80">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Campaign Filename</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1 truncate" title={filename}>
                    {filename}
                  </p>
                </div>
                <p className="text-xs text-error font-medium leading-relaxed">
                  * Warning: This action is permanent. All mapped matches, overrides, and generated Excel spreadsheets on the server will be deleted.
                </p>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Enter Password to Authorize
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter fixed deletion password"
                  autoFocus
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-error/20 focus:border-error outline-none transition-all text-sm font-medium"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3.5 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-error hover:bg-error/95 text-white rounded-xl text-xs font-bold shadow-lg shadow-error/20 hover:shadow-error/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Campaign
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
