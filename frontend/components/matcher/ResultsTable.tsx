import React from "react";
import { Search, BarChart3, ArrowUpDown, Check, X, Edit2, Info, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ResultsTableProps {
  results: any[];
  sortedAndFilteredResults: any[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (val: number) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortConfig: { key: string; direction: "asc" | "desc" } | null;
  requestSort: (key: string) => void;
  handleApprove: (idx: number) => void;
  handleReject: (idx: number) => void;
  onManualSelect: (res: any) => void;
  onViewDetails: (res: any) => void;
}

const ProductImage: React.FC<{ src?: string; alt?: string }> = ({ src, alt }) => {
  const [error, setError] = React.useState(false);

  if (!src || error) {
    return (
      <div className="w-10 h-10 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
        <ImageIcon className="w-5 h-5 text-zinc-300 dark:text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
      <img
        src={src}
        alt={alt}
        onError={() => setError(true)}
        className="w-full h-full object-contain p-0.5"
      />
    </div>
  );
};

export const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  sortedAndFilteredResults,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  searchQuery,
  setSearchQuery,
  sortConfig,
  requestSort,
  handleApprove,
  handleReject,
  onManualSelect,
  onViewDetails,
}) => {
  const getMethodBadge = (method?: string) => {
    switch (method) {
      case "international barcode":
        return <span className="px-2 py-1 bg-blue-500/10 text-blue-600 text-[10px] font-bold uppercase rounded-md border border-blue-500/20">Barcode</span>;
      case "code":
        return <span className="px-2 py-1 bg-purple-500/10 text-purple-600 text-[10px] font-bold uppercase rounded-md border border-purple-500/20">Code</span>;
      default:
        return <span className="px-2 py-1 bg-zinc-500/10 text-zinc-600 text-[10px] font-bold uppercase rounded-md border border-zinc-500/20">Normalizer</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "matched":
        return <span className="px-2 py-1 bg-success/10 text-success text-[10px] font-bold uppercase rounded-md border border-success/20">Matched</span>;
      case "review":
        return <span className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-bold uppercase rounded-md border border-warning/20">Review</span>;
      default:
        return <span className="px-2 py-1 bg-error/10 text-error text-[10px] font-bold uppercase rounded-md border border-error/20">No Match</span>;
    }
  };

  return (
    <div className="rounded-2xl border border-primary/50 bg-white/50 dark:bg-black/50 backdrop-blur-md overflow-hidden flex flex-col h-[750px] w-full">
      <div className="p-4 border-b border-primary/50 bg-primary/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-bold uppercase tracking-wider text-zinc-500">Matching Results</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-medium">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                className="bg-white dark:bg-zinc-900 border border-primary/20 rounded-lg text-xs p-1 outline-none focus:ring-1 focus:ring-primary"
              >
                {[25, 50, 100, 200].map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-zinc-500 font-medium">{totalItems} total filtered</span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-primary/20 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {results.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-12 space-y-4">
            <Search className="w-12 h-12 opacity-20" />
            <p className="font-medium">No results yet. Start matching to see data here.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-md z-10 shadow-sm">
              <tr className="text-xs font-bold text-zinc-500 uppercase">
                <th className="p-4 border-b border-primary/50 cursor-pointer hover:bg-primary/5" onClick={() => requestSort("row_index")}>
                  <div className="flex items-center gap-1">
                    Row <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-4 border-b border-primary/50">Image</th>
                <th className="p-4 border-b border-primary/50">Top Match
                  <small className="border border-primary text-primary px-2 py-0.5 rounded-full bg-primary-dark/10 ms-2 relative bottom-0.25">Standard</small>
                </th>
                <th className="p-4 border-b border-primary/50">Original Name
                  <small className="border border-primary text-primary px-2 py-0.5 rounded-full bg-primary-dark/10 ms-2 relative bottom-0.25">Pharmacy</small>
                </th>
                <th className="p-4 border-b border-primary/50 cursor-pointer hover:bg-primary/5" onClick={() => requestSort("score")}>
                  <div className="flex items-center gap-1">
                    Score <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-4 border-b border-primary/50 cursor-pointer hover:bg-primary/5" onClick={() => requestSort("status")}>
                  <div className="flex items-center gap-1">
                    Status <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-4 border-b border-primary/50 cursor-pointer hover:bg-primary/5" onClick={() => requestSort("matching_method")}>
                  <div className="flex items-center gap-1">
                    Matching Method <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-4 border-b border-primary/50 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredResults.map((res) => (
                <motion.tr
                  key={res.row_index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="group hover:bg-primary/5 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <td className="p-4 text-xs text-zinc-400">#{res.row_index + 1}</td>
                  <td className="p-4">
                    <ProductImage
                      src={res.matches[0]?.image || res.matches[0]?.product_data?.image}
                      alt={res.matches[0]?.name_en}
                    />
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {res.matches[0]?.name_en || "---"}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-medium">
                      SKU: {res.matches[0]?.sku || "N/A"}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{res.original_name}</p>
                    <p className="text-[10px] text-zinc-500 font-medium truncate max-w-[150px]">{res.normalized_name}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                        {res.matches[0] ? (res.matches[0].score * 100).toFixed(1) + "%" : "0%"}
                      </span>
                      {res.matches[0] && (
                        <div className="w-16 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-1 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              res.matches[0].score >= 0.8 ? "bg-success" : res.matches[0].score >= 0.6 ? "bg-warning" : "bg-error"
                            )}
                            style={{ width: `${res.matches[0].score * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">{getStatusBadge(res.matches[0]?.status || "no_match")}</td>
                  <td className="p-4">{getMethodBadge(res.matching_method)}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {res.matches[0]?.status === "review" && (
                        <>
                          <button
                            onClick={() => handleApprove(res.row_index)}
                            className="p-1.5 bg-success/10 text-success hover:bg-success/20 rounded-md transition-colors"
                            title="Approve Match"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(res.row_index)}
                            className="p-1.5 bg-error/10 text-error hover:bg-error/20 rounded-md transition-colors"
                            title="Reject Match"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onManualSelect(res)}
                        className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                        title="Manual Selection"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onViewDetails(res)}
                        className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
                        title="Details"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-primary/20 bg-primary/5 flex items-center justify-between">
          <p className="text-xs text-zinc-500 font-medium">
            Showing Page <span className="font-bold text-foreground">{currentPage}</span> of <span className="font-bold text-foreground">{totalPages}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-white dark:bg-zinc-900 border border-primary/20 rounded-lg text-zinc-500 hover:bg-primary/5 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 mx-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                      currentPage === pageNum
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : "bg-white dark:bg-zinc-900 border border-primary/20 text-zinc-500 hover:bg-primary/5"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-white dark:bg-zinc-900 border border-primary/20 rounded-lg text-zinc-500 hover:bg-primary/5 disabled:opacity-50 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
