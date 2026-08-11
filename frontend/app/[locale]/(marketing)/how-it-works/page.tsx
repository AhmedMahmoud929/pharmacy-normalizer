"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, 
  Search, 
  Layers, 
  Cpu, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Info,
  TextQuote,
  Binary,
  Database,
  BarChart3,
  Loader2,
  AlertCircle
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { API_URL } from "@/lib/utils";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface MatchStep {
  title: string;
  description: string;
  icon: React.ElementType;
  details: string[];
}

// --- Components ---

const StepCard = ({ step, index }: { step: MatchStep; index: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative flex items-start gap-6 group"
    >
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-lg shadow-primary/5">
          <step.icon className="w-6 h-6" />
        </div>
        {index < 4 && (
          <div className="w-px h-full min-h-[100px] bg-gradient-to-b from-primary/20 to-transparent mt-4" />
        )}
      </div>
      <div className="flex-1 pt-2 pb-12">
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{step.title}</h3>
        <p className="text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed max-w-2xl">
          {step.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {step.details.map((detail, i) => (
            <span 
              key={i}
              className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider border border-zinc-200 dark:border-zinc-700"
            >
              {detail}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default function HowItWorks() {
  const t = useTranslations("HowItWorks");
  const [query, setQuery] = useState("Panadol 500mg Extra");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const steps: MatchStep[] = [
    {
      title: t("step_1_title"),
      description: t("step_1_desc"),
      icon: TextQuote,
      details: [t("step_1_detail_1"), t("step_1_detail_2"), t("step_1_detail_3")]
    },
    {
      title: t("step_2_title"),
      description: t("step_2_desc"),
      icon: Binary,
      details: [t("step_2_detail_1"), t("step_2_detail_2"), t("step_2_detail_3")]
    },
    {
      title: t("step_3_title"),
      description: t("step_3_desc"),
      icon: Database,
      details: [t("step_3_detail_1"), t("step_3_detail_2"), t("step_3_detail_3")]
    },
    {
      title: t("step_4_title"),
      description: t("step_4_desc"),
      icon: Cpu,
      details: [t("step_4_detail_1"), t("step_4_detail_2"), t("step_4_detail_3")]
    },
    {
      title: t("step_5_title"),
      description: t("step_5_desc"),
      icon: CheckCircle2,
      details: [t("step_5_detail_1"), t("step_5_detail_2"), t("step_5_detail_3")]
    }
  ];

  const handleDemo = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/match?q=${encodeURIComponent(query)}&top=1`);
      if (!res.ok) throw new Error("Failed to connect to API");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(`Make sure the backend is running and accessible at ${API_URL}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleDemo();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider"
          >
            <Zap className="w-3 h-3" />
            {t("badge")}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight"
          >
            {t("title_main")} <span className="text-primary text-glow">{t("title_highlight")}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed"
          >
            {t("subtitle")}
          </motion.p>
        </div>
      </section>

      {/* Pipeline Section */}
      <section className="py-24 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-3">
              <Layers className="w-8 h-8 text-primary" />
              {t("pipeline_title")}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              {t("pipeline_subtitle")}
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((step, idx) => (
              <StepCard key={idx} step={step} index={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-24 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t("demo_title")}</h2>
            <p className="text-zinc-500 dark:text-zinc-400">{t("demo_subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Input Side */}
            <div className="space-y-8 bg-zinc-50 dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/50">
              <div className="space-y-4">
                <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest px-1">
                  {t("demo_input_label")}
                </label>
                <div className="relative group flex items-center">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDemo()}
                    placeholder={t("demo_placeholder")}
                    className="w-full h-16 pl-6 pr-16 rtl:pl-16 rtl:pr-6 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-lg font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none"
                  />
                  <button 
                    onClick={handleDemo}
                    disabled={loading}
                    className="absolute right-3 rtl:right-auto rtl:left-3 top-3 w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 animate-spin" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => { setQuery("بانادول ٥٠٠ مجم"); handleDemo(); }}
                  className="px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:border-primary/50 transition-colors text-left rtl:text-right"
                >
                  {t("demo_try_ar")}
                </button>
                <button 
                  onClick={() => { setQuery("Augmentin 1gm tab"); handleDemo(); }}
                  className="px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:border-primary/50 transition-colors text-left rtl:text-right"
                >
                  {t("demo_try_en")}
                </button>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3 text-error text-sm font-medium">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}
            </div>

            {/* Result Side */}
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {result ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-6"
                  >
                    {/* Top Result Card */}
                    <div className="p-8 bg-primary rounded-3xl text-white shadow-2xl shadow-primary/30 relative overflow-hidden">
                      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-white/10 rounded-full blur-3xl pointer-events-none" />
                      
                      <div className="flex items-center justify-between mb-6 relative z-10">
                        <span className="text-xs font-bold uppercase tracking-widest opacity-80">{t("demo_confidence")}</span>
                        <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-tighter">
                          {result.results?.[0]?.status === 'matched' ? t("demo_verified") : t("demo_manual")}
                        </div>
                      </div>

                      <div className="space-y-1 relative z-10">
                        <h4 className="text-3xl font-extrabold leading-tight">
                          {result.results?.[0]?.name_en || "No Match Found"}
                        </h4>
                        <p className="text-white/70 font-medium text-sm flex items-center gap-2">
                          <Database className="w-4 h-4" />
                          {t("demo_db_normalized")} {result.results?.[0]?.db_normalized || "N/A"}
                        </p>
                      </div>

                      <div className="mt-8 pt-8 border-t border-white/20 flex items-center gap-12 relative z-10">
                        <div className="space-y-1">
                          <span className="block text-xs font-bold uppercase tracking-widest opacity-70">{t("demo_score")}</span>
                          <span className="text-4xl font-black">{Math.round((result.results?.[0]?.score || 0) * 100)}%</span>
                        </div>
                        <div className="space-y-1">
                          <span className="block text-xs font-bold uppercase tracking-widest opacity-70">{t("demo_candidates")}</span>
                          <span className="text-4xl font-black">{result.results?.[0]?.candidate_count || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Card */}
                    <div className="p-8 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-8 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        <h5 className="font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-widest text-xs">{t("breakdown_title")}</h5>
                      </div>

                      <div className="space-y-6">
                        {/* Jaccard */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{t("breakdown_jaccard")}</span>
                            <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">{Math.round((result.results?.[0]?.jaccard || 0) * 100)}%</span>
                          </div>
                          <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(result.results?.[0]?.jaccard || 0) * 100}%` }}
                              className="h-full bg-primary"
                            />
                          </div>
                          <p className="text-[10px] text-zinc-400 font-medium">{t("breakdown_jaccard_desc")}</p>
                        </div>

                        {/* Sequence */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{t("breakdown_sequence")}</span>
                            <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">{Math.round((result.results?.[0]?.sequence || 0) * 100)}%</span>
                          </div>
                          <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(result.results?.[0]?.sequence || 0) * 100}%` }}
                              className="h-full bg-blue-500"
                            />
                          </div>
                          <p className="text-[10px] text-zinc-400 font-medium">{t("breakdown_sequence_desc")}</p>
                        </div>
                      </div>

                      {/* Tokens */}
                      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t("breakdown_matched")}</span>
                          <div className="flex flex-wrap gap-2">
                            {result.results?.[0]?.matched_tokens?.map((t: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-success/10 text-success text-[11px] font-bold rounded-md border border-success/20 uppercase tracking-wider">
                                {t}
                              </span>
                            )) || <span className="text-zinc-500 text-xs italic">{t("breakdown_none")}</span>}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t("breakdown_unmatched")}</span>
                          <div className="flex flex-wrap gap-2">
                            {result.results?.[0]?.unmatched_query_tokens?.map((t: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-error/10 text-error text-[11px] font-bold rounded-md border border-error/20 uppercase tracking-wider">
                                {t}
                              </span>
                            )) || <span className="text-zinc-500 text-xs italic">{t("breakdown_none")}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-zinc-50/50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl animate-pulse">
                    <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h5 className="text-lg font-bold text-zinc-400">{t("ready_title")}</h5>
                    <p className="text-sm text-zinc-500 max-w-[240px]">{t("ready_desc")}</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Rationale Section */}
      <section className="py-24 bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">{t("blackbox_title")}</h2>
              <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {t("blackbox_desc")}
              </p>
            </div>

            <div className="space-y-6">
              {[
                { title: t("blackbox_item1_title"), desc: t("blackbox_item1_desc") },
                { title: t("blackbox_item2_title"), desc: t("blackbox_item2_desc") },
                { title: t("blackbox_item3_title"), desc: t("blackbox_item3_desc") }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h6 className="font-bold text-zinc-900 dark:text-zinc-50">{item.title}</h6>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
             <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full -z-10 animate-pulse" />
             <div className="p-8 bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-4 mb-8 pb-8 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white">
                    <Info className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-50">{t("didyouknow_title")}</h4>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">{t("didyouknow_subtitle")}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="text-center p-6 bg-zinc-50 dark:bg-zinc-950 rounded-2xl">
                    <span className="text-5xl font-black text-primary">v9.0</span>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-2">{t("didyouknow_stat")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl">
                      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">70%</span>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t("didyouknow_jaccard")}</p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl">
                      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">30%</span>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t("didyouknow_seq")}</p>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">{t("cta_title")}</h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            {t("cta_subtitle")}
          </p>
          <div className="flex justify-center gap-4">
            <Link 
              href="/dashboard/matcher"
              className="px-8 py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-dark hover:scale-105 transition-all shadow-lg shadow-primary/20"
            >
              {t("cta_btn_matcher")}
            </Link>
            <Link 
              href="/dashboard/search"
              className="px-8 py-4 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 font-bold rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
            >
              {t("cta_btn_search")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
