"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Database, Search, ChevronLeft, ChevronRight, Loader2, Package, Tag, Layers, ExternalLink, Filter, Eye, Download, LayoutGrid, List, MoreHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, API_URL } from "@/lib/utils";
import { ProductDetailModal } from "@/components/matcher/ProductDetailModal";
import { ExportWizardModal } from "@/components/matcher/ExportWizardModal";

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
  count?: number;
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
}

export default function BrowsePage() {
  const [activeTab, setActiveTab] = useState<TabType>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(50);
  const [imageStatusFilter, setImageStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail & Export Modal States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = "";
      if (activeTab === "products") {
        const filterParam = imageStatusFilter !== "all" ? `&image_status=${imageStatusFilter}` : "";
        url = `${API_URL}/db/products?limit=${limit}&offset=${page * limit}${search ? `&search=${encodeURIComponent(search)}` : ""}${filterParam}`;
      } else if (activeTab === "brands") {
        url = `${API_URL}/db/brands`;
      } else if (activeTab === "categories") {
        url = `${API_URL}/db/categories`;
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
  }, [activeTab, page, limit, imageStatusFilter, search]);

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
    { id: "products", label: "Products", icon: Package },
    { id: "brands", label: "Brands", icon: Tag },
    { id: "categories", label: "Categories", icon: Layers },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Database <span className="text-primary">Browser</span>
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              Exploring {total?.toLocaleString() ?? 0} {activeTab} in the master reference catalog.
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
                  "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
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

        {activeTab === "products" && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <form onSubmit={handleSearch} className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products, brands, SKUs..."
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
              />
            </form>
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 shadow-sm">
              <Filter className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <select
                value={imageStatusFilter}
                onChange={(e) => {
                  setImageStatusFilter(e.target.value);
                  setPage(0);
                }}
                className="bg-transparent text-sm font-bold text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer border-none p-0 focus:ring-0"
              >
                <option value="all">All Images</option>
                <option value="local">Local Images</option>
                <option value="cdn">CDN Images</option>
              </select>
            </div>
            
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
                title="List View"
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
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            
            <button
              onClick={() => setIsExportOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white text-sm font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Export Catalog
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
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
              className="px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <AnimatePresence mode="wait">
              {activeTab === "products" && (
                viewMode === "list" ? (
                  <motion.table
                    key="products-table"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full text-left border-collapse"
                  >
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-black/50 border-b border-zinc-100 dark:border-zinc-800">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Product Info</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Categorization</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">Image Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Inventory</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Links</th>
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
                                  {p.brand?.name || "No Brand"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md w-fit border border-zinc-200/50 dark:border-zinc-700/50">
                                <Layers className="w-3 h-3 text-zinc-400" />
                                <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-600 dark:text-zinc-300">
                                  {p.category?.name || "Uncategorized"}
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
                              {p.is_local_image ? "Local Image" : "CDN Image"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{p.price} EGP</p>
                              <div className={`text-[10px] font-bold uppercase flex items-center gap-1 ${p.in_stock ? 'text-success' : 'text-error'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${p.in_stock ? 'bg-success' : 'bg-error'}`} />
                                {p.in_stock ? `${p.stock} in stock` : 'Out of stock'}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-4">
                              <button
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setIsDetailOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-primary transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Details
                              </button>
                              <a
                                href={p.share_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-primary transition-colors group/link"
                              >
                                View Store
                                <ExternalLink className="w-3 h-3 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
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
                        <div className="relative h-32 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-100 dark:border-zinc-800 p-3 flex items-center justify-center overflow-hidden flex-shrink-0">
                          <img
                            src={p.is_local_image ? `${API_URL}${p.local_image_url}` : p.image}
                            alt={p.name_en}
                            className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                          />
                          
                          {/* Floating Status Badge */}
                          <div className="absolute top-2 right-2">
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
                                <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded uppercase tracking-tight truncate max-w-[60px]" title={p.brand?.name || "No Brand"}>
                                  {p.brand?.name || "No Brand"}
                                </span>
                                <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded uppercase tracking-tight truncate max-w-[60px]" title={p.category?.name || "Uncategorized"}>
                                  {p.category?.name || "Uncategorized"}
                                </span>
                              </div>
                              <span className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap",
                                p.in_stock
                                  ? "bg-emerald-500/10 text-success border border-emerald-500/20"
                                  : "bg-red-500/10 text-error border border-red-500/20"
                              )}>
                                {p.in_stock ? "In Stock" : "Out of Stock"}
                              </span>
                            </div>

                            {/* Title & SKU */}
                            <div className="space-y-0.5">
                              <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-50 line-clamp-1 group-hover:text-primary transition-colors leading-tight" title={p.name_en}>
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
                          <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5 flex-shrink-0">
                            <div className="flex items-center justify-between">
                              <p className="font-extrabold text-xs text-zinc-900 dark:text-zinc-50 leading-none">
                                {p.price} <span className="text-[9px] font-medium text-zinc-500">EGP</span>
                              </p>
                            </div>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setActiveDropdownId(activeDropdownId === p.id ? null : p.id)}
                                className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                                Actions
                              </button>

                              {activeDropdownId === p.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setActiveDropdownId(null)} />
                                  <div className="absolute right-0 bottom-full mb-1.5 w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedProduct(p);
                                        setIsDetailOpen(true);
                                        setActiveDropdownId(null);
                                      }}
                                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-[10px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-zinc-400" />
                                      Details
                                    </button>
                                    <a
                                      href={p.share_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => setActiveDropdownId(null)}
                                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-[10px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                                      Store
                                    </a>
                                  </div>
                                </>
                              )}
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
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">{brand.count} Products</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === "categories" && (
                <motion.div
                  key="categories-grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-zinc-100 dark:bg-zinc-800"
                >
                  {categories.map((cat, idx) => (
                    <div key={idx} className="bg-white dark:bg-zinc-900 p-6 flex flex-col items-center text-center space-y-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-black border border-zinc-100 dark:border-zinc-800 flex items-center justify-center">
                        <Layers className="w-8 h-8 text-zinc-300" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-50">{cat.name}</h3>
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">{cat.count} Products</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === "products" && total > 0 && (
          <div className="px-6 py-4 bg-zinc-50 dark:bg-black/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6 flex-wrap">
              <p className="text-xs text-zinc-500 font-medium">
                Showing {total > 0 ? page * limit + 1 : 0} to {Math.min((page + 1) * limit, total || 0)} of {total?.toLocaleString() ?? 0}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-medium">Show:</span>
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
                  className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:text-primary disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold px-4 text-zinc-700 dark:text-zinc-300">Page {page + 1}</span>
                <button
                  disabled={(page + 1) * limit >= total || isLoading}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:text-primary disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ProductDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        product={selectedProduct}
      />

      <ExportWizardModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        activeSearch={search}
        totalProducts={total}
      />
    </div>
  );
}
