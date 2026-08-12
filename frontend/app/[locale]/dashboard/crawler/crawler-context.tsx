"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { API_URL } from "@/lib/utils";
import { authEventSourceUrl } from "@/lib/auth";

// Types
export interface Job {
  job_id: string;
  status: "pending" | "running" | "completed" | "stopped" | "failed";
  pid: number | null;
  target: string;
  params: {
    target: string;
    category_href: string;
    localize: boolean;
    country: string;
    lang: string;
    deep: boolean;
    download: boolean;
    stats_only: boolean;
    pages: string;
    background: boolean;
  };
  progress: {
    processed_categories: number;
    total_categories: number;
    products_found: number;
    current_action: string;
  };
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration?: number | null;
  error_msg: string | null;
  media_zip?: string | null;
  crawl_mode?: "catalog" | "media" | "both" | null;
  images_total?: number | null;
  images_completed?: number | null;
  media_status?: "none" | "running" | "completed" | "failed" | null;
}

export interface Product {
  id: string;
  names?: { en?: string; ar?: string };
  name?: string;
  price?: string;
  currency?: string;
  url?: string;
  brand?: { id?: string; names?: { en?: string; ar?: string }; name?: string; logo_url?: string } | string;
  category?: { id?: string; names?: { en?: string; ar?: string }; name?: string };
  subcategory?: { id?: string; names?: { en?: string; ar?: string }; name?: string };
  description?: string;
  overview?: { en?: string; ar?: string } | string;
  specification?: Record<string, string>;
  featured_image?: string;
  images?: string[];
  sub_categories?: any[];
  cover_image?: string | null;
  logo_url?: string | null;
  href_slug?: string;
  href?: string;
  slug?: string;
}

interface CrawlerContextType {
  // Orchestrate / Form States
  target: string;
  setTarget: (val: string) => void;
  categoryHref: string;
  setCategoryHref: (val: string) => void;
  country: string;
  setCountry: (val: string) => void;
  lang: string;
  setLang: (val: string) => void;
  deep: boolean;
  setDeep: (val: boolean) => void;
  download: boolean;
  setDownload: (val: boolean) => void;
  includeMedia: boolean;
  setIncludeMedia: (val: boolean) => void;
  statsOnly: boolean;
  setStatsOnly: (val: boolean) => void;
  pages: string;
  setPages: (val: string) => void;
  showParamsForm: boolean;
  setShowParamsForm: (val: boolean) => void;
  workers: number;
  setWorkers: (val: number) => void;
  crawlMode: string;
  setCrawlMode: (val: string) => void;
  useCurrentDb: boolean;
  setUseCurrentDb: (val: boolean) => void;

  // Telemetry States
  jobs: Job[];
  activeJobId: string | null;
  setActiveJobId: (val: string | null) => void;
  logs: { timestamp: string; line: string }[];
  progressMetrics: any;
  isCrawlLoading: boolean;

  // Actions
  loadJobsHistory: () => Promise<void>;
  connectToTelemetryStream: (jobId: string) => void;
  handleStartCampaign: (customPayload?: any) => Promise<void>;
  handleStopCampaign: (jobId: string) => Promise<void>;
  handleDownload: (jobId: string, format: "json" | "excel" | "media") => void;
  triggerMediaFetch: (jobId: string) => Promise<void>;

  // Explorer States
  selectedJobIdForBrowse: string | null;
  setSelectedJobIdForBrowse: (val: string | null) => void;
  explorerProducts: Product[];
  setExplorerProducts: (products: Product[]) => void;
  expTotal: number;
  setExpTotal: (total: number) => void;
  expPage: number;
  setExpPage: (page: number | ((prev: number) => number)) => void;
  expSearch: string;
  setExpSearch: (search: string) => void;
  expCategory: string;
  setExpCategory: (category: string) => void;
  expBrand: string;
  setExpBrand: (brand: string) => void;
  inspectItem: Product | null;
  setInspectItem: (item: Product | null) => void;
  activeLangTab: "en" | "ar";
  setActiveLangTab: (lang: "en" | "ar") => void;
  carouselIdx: number;
  setCarouselIdx: (idx: number) => void;
  expLoading: boolean;
  fetchExplorerDataset: () => Promise<void>;

  // Formatting Helpers
  formatTime: (isoStr: string) => string;
  parseAnsiToHtml: (ansiStr: string) => string;
  sanitizeHtml: (html: string) => string;
}

const CrawlerContext = createContext<CrawlerContextType | undefined>(undefined);

// Simple ANSI color parsing function
export function parseAnsiToHtml(ansiStr: string): string {
  let html = ansiStr
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt bridge;");

  // Fix escaping issue for safety
  html = html.replace(/&gt bridge;/g, "&gt;");

  const colorMap: Record<string, string> = {
    "30": "text-zinc-600",
    "31": "text-rose-500 font-medium",
    "32": "text-emerald-400 font-medium",
    "33": "text-amber-400 font-medium",
    "34": "text-sky-400 font-medium",
    "35": "text-purple-400 font-medium",
    "36": "text-primary font-semibold",
    "37": "text-zinc-200",
    "90": "text-zinc-500",
    "91": "text-rose-400",
    "92": "text-emerald-300",
    "93": "text-amber-300",
    "94": "text-sky-300",
    "95": "text-purple-300",
    "96": "text-primary/95",
    "97": "text-zinc-50"
  };

  html = html.replace(/\u001b\[1m/g, '<span class="font-bold">');

  html = html.replace(/\u001b\[(?:1;)?(\d+)m/g, (match, code) => {
    const className = colorMap[code];
    return className ? `<span class="${className}">` : "<span>";
  });

  const openCount = (html.match(/<span/g) || []).length;
  const closeCount = (html.match(/<\/span>/g) || []).length;
  const missing = openCount - closeCount;

  html = html.replace(/\u001b\[0m/g, "</span>".repeat(Math.max(1, missing)));
  html = html.replace(/\u001b\[\d*(?:;\d*)*[a-zA-Z]/g, "");

  return html;
}

// HTML Sanitizer
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  const cleanNode = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (["script", "iframe", "object", "embed", "link", "meta", "style"].includes(tag)) {
          el.remove();
          continue;
        }

        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          if (attr.name.startsWith("on") || attr.value.toLowerCase().includes("javascript:")) {
            el.removeAttribute(attr.name);
          }
        }

        cleanNode(el);
      }
    }
  };

  cleanNode(doc.body);
  return doc.body.innerHTML;
}

// Format creation timestamp
export const formatTime = (isoStr: string) => {
  try {
    return new Date(isoStr).toLocaleString();
  } catch {
    return isoStr;
  }
};

export const CrawlerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Configurations
  const [target, setTarget] = useState("products");
  const [categoryHref, setCategoryHref] = useState("all");
  const [country, setCountry] = useState("eg");
  const [lang, setLang] = useState("both");
  const [deep, setDeep] = useState(true);
  const [download, setDownload] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(false);
  const [statsOnly, setStatsOnly] = useState(false);
  const [pages, setPages] = useState("1");
  const [showParamsForm, setShowParamsForm] = useState(true);
  const [workers, setWorkers] = useState(4);
  const [crawlMode, setCrawlMode] = useState("catalog");
  const [useCurrentDb, setUseCurrentDb] = useState(false);

  // Campaign Job States
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ timestamp: string; line: string }[]>([]);
  const [progressMetrics, setProgressMetrics] = useState<any>(null);
  const [isCrawlLoading, setIsCrawlLoading] = useState(false);

  // Data Explorer States
  const [selectedJobIdForBrowse, setSelectedJobIdForBrowse] = useState<string | null>(null);
  const [explorerProducts, setExplorerProducts] = useState<Product[]>([]);
  const [expTotal, setExpTotal] = useState(0);
  const [expPage, setExpPage] = useState(1);
  const [expSearch, setExpSearch] = useState("");
  const [expCategory, setExpCategory] = useState("");
  const [expBrand, setExpBrand] = useState("");
  const [inspectItem, setInspectItem] = useState<Product | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<"en" | "ar">("en");
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [expLoading, setExpLoading] = useState(false);

  const sseRef = useRef<EventSource | null>(null);

  // Load history jobs
  const loadJobsHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/crawler/jobs?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);

        // Auto-reconnect or select active running job
        const active = data.jobs.find((j: Job) => j.status === "running" || j.status === "pending");
        if (active && !activeJobId) {
          setActiveJobId(active.job_id);
          connectToTelemetryStream(active.job_id);
          setShowParamsForm(false);
        }
      }
    } catch (err) {
      console.error("Failed to load jobs checklist:", err);
    }
  };

  // Connect to SSE Telemetry Stream
  const connectToTelemetryStream = (jobId: string) => {
    if (sseRef.current) sseRef.current.close();
    setLogs([]);

    const es = new EventSource(authEventSourceUrl(`/api/crawler/jobs/${jobId}/stream`));
    sseRef.current = es;

    es.addEventListener("log", (event) => {
      const data = JSON.parse(event.data);
      setLogs((prev) => [...prev, data]);
    });

    es.addEventListener("progress", (event) => {
      const data = JSON.parse(event.data);
      setProgressMetrics(data);
      loadJobsHistory();
    });

    es.addEventListener("complete", (event) => {
      es.close();
      loadJobsHistory();
      setIsCrawlLoading(false);
      setProgressMetrics(null);
    });

    es.addEventListener("error", (event) => {
      es.close();
      loadJobsHistory();
      setIsCrawlLoading(false);
      setProgressMetrics(null);
    });

    es.onerror = () => {
      es.close();
    };
  };

  // Launch Scraper
  const handleStartCampaign = async (customPayload?: any) => {
    setIsCrawlLoading(true);
    setLogs([]);
    setProgressMetrics(null);

    const payload = customPayload || {
      target,
      category_href: categoryHref,
      localize: lang === "both",
      country,
      lang: lang === "both" ? "en" : lang,
      deep,
      download,
      include_media: target !== "products" ? includeMedia : false,
      stats_only: statsOnly,
      pages,
      background: true,
      workers,
      crawl_mode: crawlMode,
      use_current_db: useCurrentDb
    };

    try {
      const res = await fetch(`${API_URL}/api/crawler/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setActiveJobId(data.job_id);
        connectToTelemetryStream(data.job_id);
        loadJobsHistory();
        setShowParamsForm(false);
      } else {
        alert("Failed to initiate crawl job. Inspect server console.");
        setIsCrawlLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert("API server unreachable.");
      setIsCrawlLoading(false);
    }
  };

  // Terminate running job
  const handleStopCampaign = async (jobId: string) => {
    if (!confirm("Are you sure you want to forcibly stop this crawling campaign?")) return;
    try {
      const res = await fetch(`${API_URL}/api/crawler/jobs/${jobId}/stop`, {
        method: "POST"
      });
      if (res.ok) {
        loadJobsHistory();
        if (sseRef.current && activeJobId === jobId) {
          sseRef.current.close();
        }
        setIsCrawlLoading(false);
        setProgressMetrics(null);
      }
    } catch (err) {
      console.error("Stop campaign crashed:", err);
    }
  };

  // Load explorer catalog datasets
  const fetchExplorerDataset = async () => {
    if (!selectedJobIdForBrowse) return;
    setExpLoading(true);
    const limit = 24;
    const offset = (expPage - 1) * limit;

    let url = `${API_URL}/api/crawler/jobs/${selectedJobIdForBrowse}/products?limit=${limit}&offset=${offset}`;
    if (expSearch) url += `&search=${encodeURIComponent(expSearch)}`;
    if (expCategory) url += `&category=${encodeURIComponent(expCategory)}`;
    if (expBrand) url += `&brand=${encodeURIComponent(expBrand)}`;

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setExplorerProducts(data.products || []);
        setExpTotal(data.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExpLoading(false);
    }
  };

  // Download files helper
  const handleDownload = (jobId: string, format: "json" | "excel" | "media") => {
    window.open(`${API_URL}/api/crawler/jobs/${jobId}/download?format=${format}`);
  };

  // Trigger media extraction for existing completed job
  const triggerMediaFetch = async (jobId: string) => {
    setIsCrawlLoading(true);
    setProgressMetrics(null);
    setLogs([]);
    try {
      const res = await fetch(`${API_URL}/api/crawler/jobs/${jobId}/fetch-media`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setActiveJobId(jobId);
        connectToTelemetryStream(jobId);
        loadJobsHistory();
      } else {
        const errData = await res.json();
        alert(`Failed to trigger image extraction: ${errData.detail || "Unknown error"}`);
        setIsCrawlLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert("API server unreachable.");
      setIsCrawlLoading(false);
    }
  };

  // Synchronize URL search parameters with state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlJobId = params.get("job_id");
      if (urlJobId) {
        setSelectedJobIdForBrowse(urlJobId);
      }
    }
  }, []);

  // When jobs list changes/loads, check if there is a URL parameter to hydrate
  useEffect(() => {
    if (jobs.length > 0 && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlJobId = params.get("job_id");
      if (urlJobId) {
        const job = jobs.find((j) => j.job_id === urlJobId);
        if (job) {
          if (activeJobId !== job.job_id) {
            setActiveJobId(job.job_id);
            if (job.status === "running" || job.status === "pending") {
              connectToTelemetryStream(job.job_id);
            }
            setShowParamsForm(false);
          }
          if (selectedJobIdForBrowse !== job.job_id) {
            setSelectedJobIdForBrowse(job.job_id);
          }
        }
      }
    }
  }, [jobs]);

  // Update URL search parameters when activeJobId or selectedJobIdForBrowse changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentJobId = activeJobId || selectedJobIdForBrowse;
      const url = new URL(window.location.href);
      const prevJobId = url.searchParams.get("job_id");
      if (currentJobId) {
        if (prevJobId !== currentJobId) {
          url.searchParams.set("job_id", currentJobId);
          window.history.replaceState({}, "", url.pathname + url.search);
        }
      } else if (prevJobId) {
        url.searchParams.delete("job_id");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
  }, [activeJobId, selectedJobIdForBrowse]);

  // Setup periodic updates and cleanups
  useEffect(() => {
    loadJobsHistory();
    const interval = setInterval(loadJobsHistory, 10000);
    return () => {
      clearInterval(interval);
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  // Fetch dataset when explorer filters/pagination update
  useEffect(() => {
    if (selectedJobIdForBrowse) {
      fetchExplorerDataset();
    }
  }, [selectedJobIdForBrowse, expPage, expSearch, expCategory, expBrand]);


  return (
    <CrawlerContext.Provider
      value={{
        target,
        setTarget,
        categoryHref,
        setCategoryHref,
        country,
        setCountry,
        lang,
        setLang,
        deep,
        setDeep,
        download,
        setDownload,
        includeMedia,
        setIncludeMedia,
        statsOnly,
        setStatsOnly,
        pages,
        setPages,
        showParamsForm,
        setShowParamsForm,
        workers,
        setWorkers,
        crawlMode,
        setCrawlMode,
        useCurrentDb,
        setUseCurrentDb,
        jobs,
        activeJobId,
        setActiveJobId,
        logs,
        progressMetrics,
        isCrawlLoading,
        loadJobsHistory,
        connectToTelemetryStream,
        handleStartCampaign,
        handleStopCampaign,
        handleDownload,
        triggerMediaFetch,
        selectedJobIdForBrowse,
        setSelectedJobIdForBrowse,
        explorerProducts,
        setExplorerProducts,
        expTotal,
        setExpTotal,
        expPage,
        setExpPage,
        expSearch,
        setExpSearch,
        expCategory,
        setExpCategory,
        expBrand,
        setExpBrand,
        inspectItem,
        setInspectItem,
        activeLangTab,
        setActiveLangTab,
        carouselIdx,
        setCarouselIdx,
        expLoading,
        fetchExplorerDataset,
        formatTime,
        parseAnsiToHtml,
        sanitizeHtml
      }}
    >
      {children}
    </CrawlerContext.Provider>
  );
};

export const useCrawler = () => {
  const context = useContext(CrawlerContext);
  if (context === undefined) {
    throw new Error("useCrawler must be used within a CrawlerProvider");
  }
  return context;
};
