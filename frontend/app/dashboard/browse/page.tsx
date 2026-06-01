"use client";

import React, { useState, useEffect } from "react";
import { Database, Search, ChevronLeft, ChevronRight, Loader2, Package, Tag, Layers, ExternalLink, Filter, Eye, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, API_URL } from "@/lib/utils";
import { ProductDetailModal } from "@/components/matcher/ProductDetailModal";
import { ExportWizardModal } from "@/components/matcher/ExportWizardModal";

type TabType = "products" | "brands" | "categories";

export default function BrowsePage() {
  const [activeTab, setActiveTab] = useState<TabType>("products");
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail & Export Modal States
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = "";
      if (activeTab === "products") {
        url = `${API_URL}/db/products?limit=${limit}&offset=${page * limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
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
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, page]);

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
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Inventory</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Links</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white">
                              <img src={p.image} alt={p.name_en} className="w-full h-full object-contain" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 leading-tight mb-1">{p.name_en}</p>
                              <p className="text-[10px] text-zinc-500 font-medium truncate max-w-[250px]">{p.name_ar}</p>
                              <p className="text-[10px] text-primary font-bold mt-1">SKU: {p.sku}</p>
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
                      <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-black border border-zinc-100 dark:border-zinc-800 flex items-center justify-center">
                        <Tag className="w-8 h-8 text-zinc-300" />
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

        {activeTab === "products" && total > limit && (
          <div className="px-6 py-4 bg-zinc-50 dark:bg-black/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <p className="text-xs text-zinc-500 font-medium">
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, total || 0)} of {total?.toLocaleString() ?? 0}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0 || isLoading}
                onClick={() => setPage(p => p - 1)}
                className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:text-primary disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold px-4">Page {page + 1}</span>
              <button
                disabled={(page + 1) * limit >= total || isLoading}
                onClick={() => setPage(p => p + 1)}
                className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:text-primary disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
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
