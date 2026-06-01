"use client";

import React from "react";
import Link from "next/link";
import { Activity, Table, Database, Search, FileText, ArrowRight, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    name: "Batch Drug Matcher",
    description: "Upload pharmacy catalog sheets and map them to the master database with multi-core parallel processing.",
    href: "/dashboard/matcher",
    icon: Table,
    color: "bg-blue-500",
    shadow: "shadow-blue-500/20",
  },
  {
    name: "Database Browser",
    description: "Explore the complete master database of products, SKUs, brands, and categories with detailed variant views.",
    href: "/dashboard/browse",
    icon: Database,
    color: "bg-purple-500",
    shadow: "shadow-purple-500/20",
  },
  {
    name: "Global Smart Search",
    description: "Instantly lookup any product using our high-performance fuzzy matching and normalization engine.",
    href: "/dashboard/search",
    icon: Search,
    color: "bg-emerald-500",
    shadow: "shadow-emerald-500/20",
  },
  {
    name: "Normalization Lab",
    description: "Test and debug the normalization pipeline. See how raw product names are translated and cleaned.",
    href: "/dashboard/normalize",
    icon: FileText,
    color: "bg-orange-500",
    shadow: "shadow-orange-500/20",
  },
];

export default function Home() {
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
              Engine v9.0-Turbo Active
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 max-w-4xl"
            >
              Master Your <span className="text-primary">Pharmacy Data</span> with Intelligence
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed"
            >
              The advanced AI-powered platform for pharmacy catalog normalization, mapping, and database management.
              Built for speed, accuracy, and enterprise-scale operations.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              <Link
                href="/dashboard/matcher"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-dark hover:scale-105 transition-all active:scale-95"
              >
                <Table className="w-5 h-5" />
                Start Matching
              </Link>
              <Link
                href="/dashboard/browse"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 font-bold rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
              >
                Browse Database
                <ArrowRight className="w-5 h-5" />
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
                Enterprise Validated
              </div>
              <div className="flex items-center gap-2 font-bold text-zinc-400">
                <Zap className="w-5 h-5" />
                Turbo Processing
              </div>
              <div className="flex items-center gap-2 font-bold text-zinc-400">
                <Activity className="w-5 h-5" />
                99.9% Up-time
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Comprehensive Toolset</h2>
            <p className="text-zinc-500 dark:text-zinc-400">Everything you need to handle complex medical product datasets.</p>
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
                    <ArrowRight className="w-4 h-4" />
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
