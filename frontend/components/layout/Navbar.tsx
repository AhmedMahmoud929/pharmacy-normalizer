"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Table, Search, FileText, Database, Settings, Home, Info, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/providers/ThemeProvider";
import { API_URL } from "@/lib/utils";

const showCrawler = process.env.NEXT_PUBLIC_ENABLE_CRAWLER === "true";

const navItems = [
  { name: "Match Sheet", href: "/dashboard/matcher", icon: Table },
  ...(showCrawler ? [{ name: "Campaign Crawler", href: "/dashboard/crawler", icon: Terminal }] : []),
  { name: "Browse DB", href: "/dashboard/browse", icon: Database },
  { name: "Global Search", href: "/dashboard/search", icon: Search },
  { name: "Normalize", href: "/dashboard/normalize", icon: FileText },
];



export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { theme } = { theme: "dark" }; // Hardcoded for now to avoid breaking existing logic
  const [isScrolled, setIsScrolled] = useState(false);
  const [apiStatus, setApiStatus] = useState<"loading" | "online" | "offline">("loading");


  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    // Check API Status
    const checkApi = async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        if (res.ok) setApiStatus("online");
        else setApiStatus("offline");
      } catch {
        setApiStatus("offline");
      }
    };
    checkApi();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${isScrolled
        ? "py-3 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-zinc-200 dark:border-zinc-800 shadow-sm"
        : "py-6 bg-transparent border-transparent"
        }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-50">
              PHARMATCH<span className="text-primary">AI</span>
            </span>
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest leading-none">
              v9.0 Engine
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <div className="hidden md:flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${isActive
                  ? "text-primary"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-full shadow-sm"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <item.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800">
            <div className={`w-2 h-2 rounded-full animate-pulse ${apiStatus === 'online' ? 'bg-success' : apiStatus === 'loading' ? 'bg-warning' : 'bg-error'
              }`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {apiStatus === 'online' ? 'System Online' : apiStatus === 'loading' ? 'Connecting...' : 'System Offline'}
            </span>
          </div>

        </div>
      </div>
    </nav>
  );
};
