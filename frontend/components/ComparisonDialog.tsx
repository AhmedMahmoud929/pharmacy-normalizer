import React from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

interface ComparisonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: MatchResult | null;
}

export const ComparisonDialog: React.FC<ComparisonDialogProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  const match = data.matches[0];
  const hasMatch = !!match;

  const renderTokenList = (tokens: string[] | undefined, type: "matched" | "unmatched" | "unmatched_db") => {
    if (!tokens || tokens.length === 0) return <span className="text-sm text-neutral-muted italic">None</span>;
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {tokens.map((t, idx) => (
          <span
            key={idx}
            className={`px-2 py-1 text-xs font-semibold rounded-md border ${
              type === "matched"
                ? "bg-success-subtle text-success border-success/20"
                : type === "unmatched"
                ? "bg-error-subtle text-error border-error/20"
                : "bg-warning-subtle text-warning border-warning/20"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-950 w-full max-w-6xl rounded-2xl shadow-2xl border border-primary/20 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-primary/10 flex items-center justify-between bg-primary/5">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Detailed Match Analysis</h2>
                  <p className="text-sm text-neutral-muted">Row #{data.row_index + 1}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-neutral-gray/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-muted" />
                </button>
              </div>

              {/* Content Split */}
              <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-primary/10">
                {/* Left Panel: Query */}
                <div className="p-8 space-y-8 bg-white/50 dark:bg-black/50">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                      <SearchIcon className="w-4 h-4" /> Input Data
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <label className="text-xs text-neutral-muted block mb-1">Original Name (Raw)</label>
                        <p className="text-lg font-medium text-foreground">{data.original_name}</p>
                      </div>
                      <div className="p-4 bg-neutral-gray/5 rounded-xl border border-neutral-gray/10">
                        <label className="text-xs text-neutral-muted block mb-1">Normalized Internal Query</label>
                        <p className="font-mono text-sm text-primary">{data.normalized_name}</p>
                      </div>
                    </div>
                  </div>

                  {hasMatch && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-neutral-muted uppercase">Query Unmatched Tokens</label>
                        <p className="text-xs text-neutral-muted mb-2">Words in the query that did NOT map to the database.</p>
                        {renderTokenList(match.unmatched_query_tokens, "unmatched")}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-muted uppercase">Matched Tokens</label>
                        <p className="text-xs text-neutral-muted mb-2">Words that matched perfectly or closely.</p>
                        {renderTokenList(match.matched_tokens, "matched")}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Panel: Database Match */}
                <div className="p-8 space-y-8 bg-neutral-gray/5 dark:bg-zinc-900/50">
                  {!hasMatch ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-neutral-muted">
                      <AlertCircle className="w-12 h-12 opacity-20" />
                      <p className="text-lg">No Match Found</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-success mb-4 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Best Database Match
                        </h3>
                        <div className="space-y-6">
                          {match.image && (
                            <div className="w-full h-48 bg-white dark:bg-black rounded-xl border border-neutral-gray/10 shadow-sm flex items-center justify-center p-2 overflow-hidden">
                              <img src={match.image} alt={match.name_en || "Product"} className="max-w-full max-h-full object-contain" />
                            </div>
                          )}
                          <div>
                            <label className="text-xs text-neutral-muted block mb-1">English Product Name</label>
                            <p className="text-xl font-bold text-foreground">{match.name_en || "---"}</p>
                          </div>
                          <div className="flex gap-6">
                            <div>
                              <label className="text-xs text-neutral-muted block mb-1">SKU</label>
                              <p className="font-mono text-sm">{match.sku || "N/A"}</p>
                            </div>
                            <div>
                              <label className="text-xs text-neutral-muted block mb-1">Price</label>
                              <p className="font-mono text-sm">{match.price ? `EGP ${match.price}` : "N/A"}</p>
                            </div>
                          </div>
                          <div className="p-4 bg-white dark:bg-black rounded-xl border border-neutral-gray/10 shadow-sm">
                            <label className="text-xs text-neutral-muted block mb-1">DB Normalized Name</label>
                            <p className="font-mono text-sm text-primary">{match.db_normalized}</p>
                          </div>
                        </div>
                      </div>

                      {/* Scoring & Diagnostics */}
                      <div className="space-y-6">
                        <div>
                          <label className="text-xs font-bold text-neutral-muted uppercase">DB Unmatched Tokens</label>
                          <p className="text-xs text-neutral-muted mb-2">Words in the DB that were NOT in the query.</p>
                          {renderTokenList(match.unmatched_db_tokens, "unmatched_db")}
                        </div>

                        <div className="pt-6 border-t border-primary/10 grid grid-cols-2 gap-6">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-neutral-muted font-medium">Jaccard (Token) Score</span>
                              <span className="font-bold text-primary">{((match.jaccard || 0) * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-neutral-gray/20 rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${(match.jaccard || 0) * 100}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-neutral-muted font-medium">Sequence (Char) Score</span>
                              <span className="font-bold text-primary">{((match.sequence || 0) * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-neutral-gray/20 rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${(match.sequence || 0) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Helper Icon
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
