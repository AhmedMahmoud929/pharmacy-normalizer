"use client";

import React from "react";
import { X, ExternalLink, Tag, Layers, CheckCircle2, AlertCircle, Barcode, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, API_URL } from "@/lib/utils";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product
}) => {
  if (!isOpen || !product) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
        />

        {/* Modal Content Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
          className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-primary/10 rounded-xl">
                <Barcode className="w-5 h-5 text-primary" />
              </span>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Product Details
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body - Scrollable */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Visual Panel & Basic Specs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Image Frame */}
              <div className="relative aspect-square rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/50 overflow-hidden flex items-center justify-center p-6 group">
                <img
                  src={product.is_local_image ? `${API_URL}${product.local_image_url}` : product.image}
                  alt={product.name_en}
                  className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                />
                
                {/* Floating Image Source Indicator */}
                <div className="absolute top-3 right-3">
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-md border shadow-sm backdrop-blur-md uppercase tracking-wide",
                    product.is_local_image
                      ? "bg-emerald-50/90 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-50/90 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                  )}>
                    {product.is_local_image ? "Local API" : "Remote CDN"}
                  </span>
                </div>
              </div>

              {/* Title & Fast Specs */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {/* English Name */}
                  <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 leading-snug">
                    {product.name_en}
                  </h3>
                  {/* Arabic Name */}
                  <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 font-arabic leading-relaxed">
                    {product.name_ar}
                  </p>
                </div>

                {/* Price Display Block */}
                <div className="p-4 bg-zinc-50 dark:bg-black/40 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Active Catalog Price
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-primary">
                      {product.price}
                    </span>
                    <span className="text-sm font-bold text-zinc-500">
                      EGP
                    </span>
                  </div>
                </div>

                {/* Availability Flag */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase border ${
                      product.in_stock
                        ? "bg-success/10 border-success/20 text-success"
                        : "bg-error/10 border-error/20 text-error"
                    }`}
                  >
                    {product.in_stock ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>In Stock</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        <span>Out of Stock</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-zinc-400">
                    {product.stock ?? 10} items remaining
                  </span>
                </div>
              </div>
            </div>

            <hr className="border-zinc-100 dark:border-zinc-800" />

            {/* Structured Specifications Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Brand Card */}
              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <Tag className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Manufacturer / Brand
                  </p>
                  <p className="font-extrabold text-zinc-900 dark:text-zinc-50">
                    {product.brand?.name || product.brand || "No Brand"}
                  </p>
                </div>
              </div>

              {/* Category Card */}
              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <Layers className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Primary Classification
                  </p>
                  <p className="font-extrabold text-zinc-900 dark:text-zinc-50">
                    {product.category?.name || product.category || "Uncategorized"}
                  </p>
                </div>
              </div>

              {/* System Identifier */}
              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-4 sm:col-span-2">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <Barcode className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    System SKU & Reference Slug
                  </p>
                  <p className="font-extrabold text-zinc-900 dark:text-zinc-50 truncate">
                    {product.sku}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="p-6 bg-zinc-50 dark:bg-black/20 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">
              System ID: <code className="bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-bold">{product.id}</code>
            </span>
            {product.share_link && (
              <a
                href={product.share_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark hover:shadow-primary/30 transition-all group/btn"
              >
                Inspect on Chefaa
                <ExternalLink className="w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
