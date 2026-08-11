"use client";

import React from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Activity, Table, Database, Search, FileText, ArrowRight, ShieldCheck, Zap, Sparkles, Sprout } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const t = useTranslations("Marketing");

  const features = [
    {
      name: t("feat_matcher_title"),
      description: t("feat_matcher_desc"),
      href: "/dashboard/matcher",
      icon: Table,
      color: "bg-blue-500",
      shadow: "shadow-blue-500/20",
    },
    {
      name: t("feat_seeder_title"),
      description: t("feat_seeder_desc"),
      href: "/dashboard/catalog",
      icon: Sprout,
      color: "bg-teal-500",
      shadow: "shadow-teal-500/20",
    },
    {
      name: t("feat_browser_title"),
      description: t("feat_browser_desc"),
      href: "/dashboard/browse",
      icon: Database,
      color: "bg-purple-500",
      shadow: "shadow-purple-500/20",
    },
    {
      name: t("feat_search_title"),
      description: t("feat_search_desc"),
      href: "/dashboard/search",
      icon: Search,
      color: "bg-emerald-500",
      shadow: "shadow-emerald-500/20",
    },
    {
      name: t("feat_normalize_title"),
      description: t("feat_normalize_desc"),
      href: "/dashboard/normalize",
      icon: FileText,
      color: "bg-orange-500",
      shadow: "shadow-orange-500/20",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider"
            >
              <Sparkles className="w-3 h-3" />
              {t("tagline")}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 max-w-4xl leading-tight"
            >
              {t("hero_title")}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed"
            >
              {t("hero_subtitle")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              <Link
                href="/dashboard/matcher"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary-dark hover:scale-105 transition-all active:scale-95"
              >
                <Table className="w-5 h-5" />
                {t("btn_start")}
              </Link>
              <Link
                href="/dashboard/browse"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 font-bold rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
              >
                {t("btn_browse")}
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </Link>
            </motion.div>

            {/* Trusted Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="flex flex-wrap items-center justify-center gap-8 pt-12 opacity-50 grayscale"
            >
              <div className="flex items-center gap-2 font-bold text-zinc-400">
                <ShieldCheck className="w-5 h-5" />
                {t("badge_validated")}
              </div>
              <div className="flex items-center gap-2 font-bold text-zinc-400">
                <Zap className="w-5 h-5" />
                {t("badge_turbo")}
              </div>
              <div className="flex items-center gap-2 font-bold text-zinc-400">
                <Activity className="w-5 h-5" />
                {t("badge_uptime")}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t("features_title")}</h2>
            <p className="text-zinc-500 dark:text-zinc-400">{t("features_subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                <Link
                  href={feature.href}
                  className="group block h-full p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-black/50 transition-all hover:-translate-y-2"
                >
                  <div className={`w-14 h-14 ${feature.color} ${feature.shadow} rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3 group-hover:text-primary transition-colors">
                    {feature.name}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
                    {feature.description}
                  </p>
                  <div className="flex items-center gap-2 text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Module
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
