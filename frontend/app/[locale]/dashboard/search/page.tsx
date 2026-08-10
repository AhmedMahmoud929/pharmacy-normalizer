"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2, Sparkles, Filter, ArrowRight, Package, Tag, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/lib/utils";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [normalized, setNormalized] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("Search");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/match?q=${encodeURIComponent(query)}&top=10`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results || []);
      setNormalized(data.normalized || "");
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-12 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("title")} <span className="text-primary">{t("highlight")}</span>
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
          {t("description")}
        </p>
      </div>

      <div className="relative w-full max-w-4xl mx-auto">
        <form onSubmit={handleSearch} className="w-full relative group">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="w-full relative flex items-center p-2 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-3xl focus-within:border-primary transition-all shadow-xl">
            <Search className="w-6 h-6 ml-4 rtl:ml-0 rtl:mr-4 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("placeholder")}
              className="flex-1 w-full bg-transparent border-none outline-none px-4 py-3 text-lg font-medium"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-primary-dark transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t("button_search")}
            </button>
          </div>
        </form>

        {normalized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-full left-6 rtl:left-auto rtl:right-6 mt-4 flex items-center gap-2 text-xs font-bold text-zinc-400"
          >
            <Sparkles className="w-3 h-3 text-primary" />
            {t("normalized_prefix")} <span className="text-primary italic">"{normalized}"</span>
          </motion.div>
        )}
      </div>

      <div className="pt-12">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-4"
            >
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-zinc-500 font-bold tracking-widest uppercase text-xs">{t("loading_text")}</p>
            </motion.div>
          ) : results.length > 0 ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {results.map((res, idx) => (
                <div
                  key={idx}
                  className="group p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all hover:border-primary/50"
                >
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white flex-shrink-0 group-hover:scale-110 transition-transform">
                      <img src={res.image} alt={res.name_en} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${res.status === 'matched' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                          }`}>
                          {(res.score * 100).toFixed(1)}% {t("confidence")}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400">{t("sku")}: {res.sku}</span>
                      </div>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 leading-tight group-hover:text-primary transition-colors">
                        {res.name_en}
                      </h3>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {res.brand && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-bold text-zinc-500">
                            <Tag className="w-3 h-3" />
                            {res.brand}
                          </div>
                        )}
                        {res.category && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-bold text-zinc-500">
                            <Layers className="w-3 h-3" />
                            {res.category}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : query && !isLoading ? (
            <motion.div
              key="no-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 space-y-4"
            >
              <Search className="w-12 h-12 text-zinc-300 mx-auto" />
              <p className="text-zinc-500 font-medium">{t("no_results", { query })}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

