"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Database, Search, ChevronLeft, ChevronRight, Loader2, Package, Tag, Layers, ExternalLink, Filter, Eye, Download, LayoutGrid, List, MoreHorizontal, Folder } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, API_URL } from "@/lib/utils";
import { cardSurfaceClass } from "@/components/ui/stat-card";
import { ProductDetailModal } from "@/components/matcher/ProductDetailModal";
import { ExportWizardModal } from "@/components/matcher/ExportWizardModal";
import { FeatureBadge } from "@/components/shared/FeatureBadge";

type TabType = "products" | "brands" | "categories";

interface Brand {
  name: string;
  count?: number;
  image?: string;
  is_local_image?: boolean;
  local_image_url?: string;
}

interface Category {
  name: string;
  slug: string;
  count?: number;
  level?: number;
  parent_slug?: string | null;
  children?: Category[];
}

interface Product {
  id: string;
  name_en: string;
  name_ar: string;
  sku: string;
  image: string;
  is_local_image?: boolean;
  local_image_url?: string;
  price: number;
  in_stock: boolean;
  stock: number;
  share_link: string;
  brand?: Brand;
  category?: Category;
  description_en?: string;
  description_ar?: string;
  unit?: string;
  code?: string;
  international_barcode?: string;
  level_two_category?: { slug?: string; title_en?: string; title_ar?: string; name?: string };
  level_three_category?: { slug?: string; title_en?: string; title_ar?: string; name?: string };
  need_prescription?: boolean;
  source?: string;
}

// Collapsible Categories Tree accordion view
const TaxonomyTreeView = ({ taxonomy }: { taxonomy: Category[] }) => {
  const [expandedL1, setExpandedL1] = useState<Record<string, boolean>>({});
  const [expandedL2, setExpandedL2] = useState<Record<string, boolean>>({});
  const t = useTranslations("Browse");

  const toggleL1 = (slug: string) => {
    setExpandedL1(prev => ({ ...prev, [slug]: !prev[slug] }));
  };

  const toggleL2 = (slug: string) => {
    setExpandedL2(prev => ({ ...prev, [slug]: !prev[slug] }));
  };

  if (!taxonomy || taxonomy.length === 0) {
    return (
      <div className="p-12 text-center text-zinc-500">
        {t("taxonomy_empty")}
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
      {taxonomy.map((l1) => {
        const isL1Expanded = !!expandedL1[l1.slug];
        const hasL2 = l1.children && l1.children.length > 0;
        
        return (
          <div key={l1.slug} className="group">
            {/* Level 1 Accordion Header */}
            <button
              onClick={() => toggleL1(l1.slug)}
              className={cn(
                "w-full flex items-center justify-between p-6 text-start transition-colors cursor-pointer",
                isL1Expanded ? "bg-zinc-50 dark:bg-zinc-950/45 border-b border-zinc-100 dark:border-zinc-800/80" : "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-2xl transition-all",
                  isL1Expanded ? "bg-primary text-primary-foreground" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:text-primary"
                )}>
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-sm sm:text-base flex items-center gap-2">
                    {l1.name}
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase tracking-widest text-[8px]">{t("level_prefix")} 1</span>
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">{t("items_count", { count: l1.count ?? 0 })}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {hasL2 && l1.children && (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold bg-zinc-100 dark:bg-zinc-800/50 px-3 py-1 rounded-xl">
                    {t("subcategories_count", { count: l1.children.length })}
                  </span>
                )}
                <motion.div
                  animate={{ rotate: isL1Expanded ? 90 : 0 }}
                  className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                </motion.div>
              </div>
            </button>

            {/* Level 2 Accordion Panel */}
            <AnimatePresence initial={false}>
              {isL1Expanded && hasL2 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden bg-zinc-50/40 dark:bg-black/10"
                >
                  <div className="px-6 py-4 space-y-3 ps-12 sm:ps-16 border-b border-zinc-100 dark:border-zinc-800/50">
                    {l1.children?.map((l2: any) => {
                      const isL2Expanded = !!expandedL2[l2.slug];
                      const hasL3 = l2.children && l2.children.length > 0;

                      return (
                        <div key={l2.slug} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/60 rounded-2xl overflow-hidden shadow-sm">
                          {/* Level 2 Accordion Header */}
                          <button
                            onClick={() => toggleL2(l2.slug)}
                            className={cn(
                              "w-full flex items-center justify-between p-4 text-start transition-colors cursor-pointer",
                              isL2Expanded ? "bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800/50" : "hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-xl",
                                isL2Expanded ? "bg-zinc-100 dark:bg-zinc-800 text-primary" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                              )}>
                                <Folder className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="font-bold text-zinc-850 dark:text-zinc-200 text-xs sm:text-sm flex items-center gap-1.5">
                                  {l2.name}
                                  <span className="text-[8px] font-extrabold px-1.5 py-0.2 bg-zinc-150 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{t("level_prefix")} 2</span>
                                </h4>
                                <p className="text-[10px] text-zinc-400 font-medium mt-0.5">{t("items_count", { count: l2.count ?? 0 })}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {hasL3 && (
                                <span className="text-[9px] text-zinc-400 dark:text-zinc-550 font-bold bg-zinc-100 dark:bg-zinc-800/50 px-2.5 py-0.5 rounded-lg">
                                  {t("leaves_count", { count: l2.children.length })}
                                </span>
                              )}
                              <motion.div
                                animate={{ rotate: isL2Expanded ? 90 : 0 }}
                                className="p-1 rounded-full bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400"
                              >
                                <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                              </motion.div>
                            </div>
                          </button>

                          {/* Level 3 Collapsible Tree Leaves */}
                          <AnimatePresence initial={false}>
                            {isL2Expanded && hasL3 && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden bg-zinc-50/20 dark:bg-black/5"
                              >
                                <div className="p-4 ps-8 sm:ps-10 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {l2.children.map((l3: any) => (
                                    <div
                                      key={l3.slug}
                                      className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/50 rounded-xl hover:border-primary/20 transition-all hover:shadow-sm"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="p-1.5 bg-zinc-150 dark:bg-zinc-800 text-zinc-400 rounded-lg flex-shrink-0">
                                          <Tag className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-bold text-zinc-700 dark:text-zinc-300 text-xs truncate flex items-center gap-1.5">
                                            {l3.name}
                                            <span className="text-[7px] font-extrabold px-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{t("level_prefix")} 3</span>
                                          </p>
                                        </div>
                                      </div>
                                      
                                      <span className="text-[9px] font-bold text-zinc-400 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded border border-zinc-100/50 dark:border-zinc-850 flex-shrink-0">
                                        {t("items_count", { count: l3.count ?? 0 })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

function BrowsePageContent() {
  const [activeTab, setActiveTab] = useState<TabType>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(50);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("Browse");
  const tDash = useTranslations("Dashboard");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const productIdFromUrl = searchParams.get("product");

  // Detail & Export Modal States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const setProductInUrl = useCallback(
    (productId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (productId) params.set("product", productId);
      else params.delete("product");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const openProductDetail = useCallback(
    (product: Product) => {
      setSelectedProduct(product);
      setIsDetailOpen(true);
      setProductInUrl(String(product.id));
    },
    [setProductInUrl]
  );

  const closeProductDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedProduct(null);
    setProductInUrl(null);
  }, [setProductInUrl]);

  // Keep dialog in sync with ?product= in the URL (open, deep-link, back/forward)
  useEffect(() => {
    if (!productIdFromUrl) {
      setIsDetailOpen(false);
      setSelectedProduct(null);
      return;
    }

    if (selectedProduct && String(selectedProduct.id) === productIdFromUrl && isDetailOpen) {
      return;
    }

    const fromList = products.find((p) => String(p.id) === productIdFromUrl);
    if (fromList) {
      setSelectedProduct(fromList);
      setIsDetailOpen(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/db/products/${encodeURIComponent(productIdFromUrl)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setSelectedProduct(data);
          setIsDetailOpen(true);
        }
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      cancelled = true;
    };
    // intentionally omit selectedProduct/isDetailOpen to avoid reset loops; URL is source of truth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdFromUrl, products]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = "";
      if (activeTab === "products") {
        url = `${API_URL}/db/products?limit=${limit}&offset=${page * limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
      } else if (activeTab === "brands") {
        url = `${API_URL}/db/brands`;
      } else if (activeTab === "categories") {
        url = `${API_URL}/db/categories/taxonomy`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 503) throw new Error("Database is still loading or not found. Please ensure the backend is initialized.");
        throw new Error(`Failed to fetch ${activeTab} (Status: ${res.status})`);
      }

      const data = await res.json();
      if (activeTab === "products") {
        setProducts(data.products || []);
        setTotal(data.total || 0);
      } else if (activeTab === "brands") {
        setBrands(data || []);
        setTotal(data.length || 0);
      } else if (activeTab === "categories") {
        setCategories(data || []);
        setTotal(data.length || 0);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, limit, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "products") {
      setPage(0);
      fetchData();
    }
  };

  const tabs = [
    { id: "products", label: t("tab_products"), icon: Package },
    { id: "brands", label: t("tab_brands"), icon: Tag },
    { id: "categories", label: t("tab_categories"), icon: Layers },
  ];

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4 min-w-0 text-start">
          <div className="space-y-2">
            <FeatureBadge icon={Database} label={tDash("badge_browse")} />
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t("title")} <span className="text-primary">{t("highlight")}</span>
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              {t("subtitle", {
                count: total?.toLocaleString() ?? 0,
                tab: activeTab === "products" ? t("tab_products") : activeTab === "brands" ? t("tab_brands") : t("tab_categories")
              })}
            </p>
          </div>

          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl w-fit border border-zinc-200 dark:border-zinc-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setPage(0);
                  setSearch("");
                }}
                className={cn(
                  "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer",
                  activeTab === tab.id
                    ? "bg-white dark:bg-zinc-900 text-primary shadow-sm ring-1 ring-black/5"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {activeTab === "products" && (
            <>
              <form onSubmit={handleSearch} className="relative w-full sm:w-80">
                <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("placeholder")}
                  className="w-full ps-11 pe-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
                />
              </form>
              
              <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-2 rounded-xl transition-all cursor-pointer",
                    viewMode === "list"
                      ? "bg-white dark:bg-zinc-900 text-primary shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  )}
                  title={t("list_view")}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-2 rounded-xl transition-all cursor-pointer",
                    viewMode === "grid"
                      ? "bg-white dark:bg-zinc-900 text-primary shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  )}
                  title={t("grid_view")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
          
          <button
            onClick={() => setIsExportOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            {activeTab === "products" ? t("export_products") : activeTab === "brands" ? t("export_brands") : t("export_categories")}
          </button>
        </div>
      </div>

      <div className={cn(cardSurfaceClass, "overflow-hidden")}>
        {isLoading ? (
          <div className="h-[500px] flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-zinc-500 font-medium tracking-widest uppercase text-xs">Fetching {activeTab}...</p>
          </div>
        ) : error ? (
          <div className="h-[500px] flex flex-col items-center justify-center space-y-4 px-6 text-center">
            <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-2">
              <Database className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Connection Error</h3>
            <p className="text-zinc-500 max-w-md">{error}</p>
            <button
              onClick={() => fetchData()}
              className="px-6 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <AnimatePresence mode="wait">
              {activeTab === "products" && (
                products.length === 0 ? (
                  <motion.div
                    key="no-products"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 rounded-full flex items-center justify-center">
                      <Search className="w-8 h-8 opacity-60" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{t("empty_title")}</h3>
                      <p className="text-sm text-zinc-500 max-w-sm">
                        {t("empty_desc")}
                      </p>
                    </div>
                    {search && (
                      <button
                        onClick={() => {
                          setSearch("");
                          setPage(0);
                        }}
                        className="px-5 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-350 text-xs font-bold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer border-none outline-none"
                      >
                        {t("clear_search")}
                      </button>
                    )}
                  </motion.div>
                ) : viewMode === "list" ? (
                  <motion.table
                    key="products-table"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full text-start border-collapse"
                  >
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-black/50 border-b border-zinc-200 dark:border-zinc-800">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t("th_info")}</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t("th_categorization")}</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">{t("th_image_status")}</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t("th_inventory")}</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">{t("th_links")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white flex-shrink-0">
                                <img
                                  src={p.is_local_image ? `${API_URL}${p.local_image_url}` : p.image}
                                  alt={p.name_en}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 leading-tight mb-1">{p.name_en}</p>
                                <p className="text-[10px] text-zinc-500 font-medium truncate max-w-[250px] mb-1">{p.name_ar}</p>
                                <span className="text-[10px] text-primary font-bold">SKU: {p.sku}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md w-fit border border-zinc-200/50 dark:border-zinc-700/50">
                                <Tag className="w-3 h-3 text-zinc-400" />
                                <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-600 dark:text-zinc-300">
                                  {p.brand?.name || t("no_brand")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md w-fit border border-zinc-200/50 dark:border-zinc-700/50">
                                <Layers className="w-3 h-3 text-zinc-400" />
                                <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-600 dark:text-zinc-300">
                                  {p.category?.name || t("uncategorized")}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[9px] font-bold px-2 py-1 rounded-md border tracking-wide uppercase shadow-sm whitespace-nowrap",
                              p.is_local_image
                                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400"
                            )}>
                              {p.is_local_image ? t("image_local") : t("image_cdn")}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{p.price} EGP</p>
                              <div className={`text-[10px] font-bold uppercase flex items-center gap-1 ${p.in_stock ? 'text-success' : 'text-error'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${p.in_stock ? 'bg-success' : 'bg-error'}`} />
                                {p.in_stock ? `${p.stock} ${t("in_stock")}` : t("out_of_stock")}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-4">
                              <button
                                onClick={() => openProductDetail(p)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-primary transition-colors cursor-pointer font-sans border-none bg-transparent outline-none"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {t("view_details")}
                              </button>
                              <a
                                href={p.share_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-primary transition-colors group/link"
                              >
                                {t("view_store")}
                                <ExternalLink className="w-3 h-3 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform rtl:-scale-x-100" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </motion.table>
                ) : (
                  <motion.div
                    key="products-grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6 bg-zinc-50/50 dark:bg-black/20"
                  >
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-[310px]"
                      >
                        {/* Card Image Frame */}
                        <div className="relative h-32 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-150 dark:border-zinc-800 p-3 flex items-center justify-center overflow-hidden flex-shrink-0">
                          <img
                            src={p.is_local_image ? `${API_URL}${p.local_image_url}` : p.image}
                            alt={p.name_en}
                            className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                          />
                          
                          {/* Floating Status Badge */}
                          <div className="absolute top-2 end-2">
                            <span className={cn(
                              "text-[8px] font-bold px-1.5 py-0.5 rounded border shadow-sm backdrop-blur-md uppercase tracking-wider whitespace-nowrap",
                              p.is_local_image
                                ? "bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-50/95 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                            )}>
                              {p.is_local_image ? "Local" : "CDN"}
                            </span>
                          </div>
                        </div>

                        {/* Content Block */}
                        <div className="p-3 flex-1 flex flex-col justify-between overflow-hidden">
                          <div className="space-y-1.5">
                            {/* Categorization Pills & Inventory status combined */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1 overflow-hidden">
                                <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded uppercase tracking-tight truncate max-w-[60px]" title={p.brand?.name || t("no_brand")}>
                                  {p.brand?.name || t("no_brand")}
                                </span>
                                <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded uppercase tracking-tight truncate max-w-[60px]" title={p.category?.name || t("uncategorized")}>
                                  {p.category?.name || t("uncategorized")}
                                </span>
                              </div>
                              <span className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap",
                                p.in_stock
                                  ? "bg-emerald-500/10 text-success border border-emerald-500/20"
                                  : "bg-red-500/10 text-error border border-red-500/20"
                              )}>
                                {p.in_stock ? t("in_stock") : t("out_of_stock")}
                              </span>
                            </div>

                            {/* Title & SKU */}
                            <div className="space-y-0.5">
                              <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-50 line-clamp-1 group-hover:text-primary transition-colors leading-tight cursor-pointer" title={p.name_en}>
                                {p.name_en}
                              </h3>
                              <p className="text-[9px] text-zinc-400 font-medium truncate">
                                {p.name_ar}
                              </p>
                              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight truncate">
                                SKU: <span className="text-zinc-500 dark:text-zinc-300 font-medium">{p.sku}</span>
                              </p>
                            </div>
                          </div>

                          {/* Price & Actions */}
                          <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800 flex-shrink-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-extrabold text-xs text-zinc-900 dark:text-zinc-50 leading-none truncate">
                                {p.price} <span className="text-[9px] font-medium text-zinc-500">EGP</span>
                              </p>

                              <div className="relative shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setActiveDropdownId(activeDropdownId === p.id ? null : p.id)}
                                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-[10px] font-bold rounded-lg transition-all cursor-pointer border-none outline-none"
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                  {t("actions_dropdown")}
                                </button>

                                {activeDropdownId === p.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setActiveDropdownId(null)} />
                                    <div className="absolute end-0 bottom-full mb-1.5 w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          openProductDetail(p);
                                          setActiveDropdownId(null);
                                        }}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-start text-[10px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-none outline-none bg-transparent cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-zinc-400" />
                                        {t("details_btn")}
                                      </button>
                                      <a
                                        href={p.share_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setActiveDropdownId(null)}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-start text-[10px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                                        {t("store_btn")}
                                      </a>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )
              )}

              {activeTab === "brands" && (
                <motion.div
                  key="brands-grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-zinc-100 dark:bg-zinc-800"
                >
                  {brands.map((brand, idx) => (
                    <div key={idx} className="bg-white dark:bg-zinc-900 p-6 flex flex-col items-center text-center space-y-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center overflow-hidden p-2">
                        {brand.image ? (
                          <img
                            src={brand.is_local_image ? `${API_URL}${brand.local_image_url}` : brand.image}
                            alt={brand.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <Tag className="w-8 h-8 text-zinc-300" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-50">{brand.name}</h3>
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">{t("items_count", { count: brand.count ?? 0 })}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === "categories" && (
                <motion.div
                  key="categories-tree-wrapper"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-6 bg-zinc-50/40 dark:bg-black/10"
                >
                  <TaxonomyTreeView taxonomy={categories} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === "products" && total > 0 && (
          <div className="px-6 py-4 bg-zinc-50 dark:bg-black/50 border-t border-zinc-150 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6 flex-wrap">
              <p className="text-xs text-zinc-500 font-medium">
                {t("showing_page", {
                  start: total > 0 ? page * limit + 1 : 0,
                  end: Math.min((page + 1) * limit, total || 0),
                  total: total?.toLocaleString() ?? 0
                })}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-medium">{t("show_limit")}</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(0);
                  }}
                  className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold px-2 py-1 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer text-zinc-700 dark:text-zinc-300"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            
            {total > limit && (
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0 || isLoading}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:text-primary disabled:opacity-50 transition-colors cursor-pointer border-none outline-none rtl:rotate-180"
                >
                  <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                </button>
                <span className="text-xs font-bold px-4 text-zinc-700 dark:text-zinc-300">{t("page_prefix")} {page + 1}</span>
                <button
                  disabled={(page + 1) * limit >= total || isLoading}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:text-primary disabled:opacity-50 transition-colors cursor-pointer border-none outline-none rtl:rotate-180"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ProductDetailModal
        isOpen={isDetailOpen}
        onClose={closeProductDetail}
        product={selectedProduct}
      />

      <ExportWizardModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        activeSearch={search}
        totalProducts={total}
        mode={activeTab === "products" ? "products" : activeTab === "brands" ? "brands" : "categories"}
      />
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <BrowsePageContent />
    </Suspense>
  );
}
