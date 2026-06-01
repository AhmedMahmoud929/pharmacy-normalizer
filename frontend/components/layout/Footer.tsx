"use client";

import React from "react";
import { Activity, Mail as Github, Mail, Globe } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-12 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-50">
                PHARMATCHER <span className="text-primary">AI</span>
              </span>
            </div>
            <p className="max-w-xs text-sm text-zinc-500 leading-relaxed">
              Advancing pharmacy catalog mapping with high-performance normalization and fuzzy matching algorithms.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-50">Platform Navigation</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              <li><a href="/" className="hover:text-primary transition-colors">Home Page</a></li>
              <li><a href="/how-it-works" className="hover:text-primary transition-colors">How It Works</a></li>
              <li><a href="/dashboard/matcher" className="hover:text-primary transition-colors">Match Sheet Lab</a></li>
              {process.env.NEXT_PUBLIC_ENABLE_CRAWLER === "true" && (
                <li><a href="/dashboard/crawler" className="hover:text-primary transition-colors">Campaign Crawler</a></li>
              )}
              <li><a href="/dashboard/browse" className="hover:text-primary transition-colors">Product Browser</a></li>
              <li><a href="/dashboard/search" className="hover:text-primary transition-colors">Global Search</a></li>
              <li><a href="/dashboard/normalize" className="hover:text-primary transition-colors">Normalization Lab</a></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-50">Connect</h4>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-primary transition-colors border border-zinc-200 dark:border-zinc-800">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-primary transition-colors border border-zinc-200 dark:border-zinc-800">
                <Globe className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-900 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">
            © 2026 PharmMatcher. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-zinc-400">
            <a href="#" className="hover:text-zinc-900 dark:hover:text-zinc-100">Privacy Policy</a>
            <a href="#" className="hover:text-zinc-900 dark:hover:text-zinc-100">Terms of Service</a>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success" />
              <span>Engine v9.0.2-turbo</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
