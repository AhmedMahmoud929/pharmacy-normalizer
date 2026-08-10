"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, notFound } from "next/navigation";
import { Sliders, History, Database } from "lucide-react";
import { CrawlerProvider } from "./crawler-context";

export default function CrawlerLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_ENABLE_CRAWLER !== "true") {
    notFound();
  }

  const pathname = usePathname();

  // Compute active tab based on the current sub-route
  const getActiveTab = () => {
    if (pathname.endsWith("/campaigns")) return "campaigns";
    if (pathname.endsWith("/explorer")) return "explorer";
    return "orchestrate"; // Default to orchestrate
  };

  const activeTab = getActiveTab();

  return (
    <CrawlerProvider>
      <div className="min-h-screen bg-background text-foreground p-6 md:p-8 font-sans selection:bg-primary-dark selection:text-white">
        
        {/* Upper Glassmorphism Header */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between p-6 rounded-2xl bg-card/40 border border-border backdrop-blur-xl shadow-2xl gap-4">
            <div>
              <div className="relative flex items-center gap-2 py-2">
                <Image src="/chefaa-logo.png" alt="chefaa pharmacy" width={50} height={80} />
                <Image src="/chefaa-text.png" alt="chefaa pharmacy" width={150} height={130} className="brightness-300 hue-rotate-[-60deg] mb-1" />
                <h2 className="absolute -bottom-1 left-1/2 text-nowrap mt-auto text-sm italic text-foreground opacity-80">
                  Crawler Engine <small>v 2.0.1</small>
                </h2>
              </div>
            </div>

            {/* Navigation Bar - Router Links */}
            <div className="flex bg-muted p-1 rounded-lg border border-border">
              <Link
                href="/dashboard/crawler"
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === "orchestrate"
                    ? "bg-primary-dark text-white shadow-lg shadow-primary-deep/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sliders className="w-4 h-4" />
                Orchestrate
              </Link>
              
              <Link
                href="/dashboard/crawler/campaigns"
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === "campaigns"
                    ? "bg-primary-dark text-white shadow-lg shadow-primary-deep/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <History className="w-4 h-4" />
                Campaigns
              </Link>
              
              <Link
                href="/dashboard/crawler/explorer"
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all duration-300 ${
                  activeTab === "explorer"
                    ? "bg-primary-dark text-white shadow-lg shadow-primary-deep/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Database className="w-4 h-4" />
                Explorer
              </Link>
            </div>
          </div>
        </div>

        {/* Dynamic child view */}
        <div className="max-w-7xl mx-auto">
          {children}

          {/* Shefaa Pharmacy attribution footer */}
          <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground pb-8">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Powered by</span>
              <a
                href="https://shefaa.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:opacity-85 transition-opacity"
              >
                <div className="flex items-center gap-1">
                  <Image src="/chefaa-logo.png" alt="chefaa pharmacy" width={20} height={20} />
                  <Image src="/chefaa-text.png" alt="chefaa pharmacy" width={50} height={50} className="brightness-300 hue-rotate-[-60deg] mb-1" />
                </div>
              </a>
            </div>

            <div className="flex items-center gap-4">
              <span>© {new Date().getFullYear()} Chefaa Pharmacy. All Rights Reserved.</span>
            </div>
          </div>
        </div>

      </div>
    </CrawlerProvider>
  );
}
