"use client";

import React, { useState } from "react";
import {
  X,
  ExternalLink,
  Tag,
  Layers,
  CheckCircle2,
  AlertCircle,
  Barcode,
  Package,
  Hash,
  Copy,
  Check,
  ShieldAlert,
  Image as ImageIcon,
  FolderTree,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, API_URL } from "@/lib/utils";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
}

function categoryLabel(cat: any): string {
  if (!cat) return "";
  if (typeof cat === "string") return cat;
  return cat.name || cat.title_en || cat.title_ar || cat.slug || "";
}

function SpecRow({
  icon: Icon,
  label,
  value,
  mono,
  copyable,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copyable?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyable) return;
    try {
      await navigator.clipboard.writeText(copyable);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40">
      <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0">
        <Icon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
          {label}
        </p>
        <p
          className={cn(
            "text-sm font-semibold text-zinc-900 dark:text-zinc-50 break-words",
            mono && "font-mono text-xs tracking-tight"
          )}
        >
          {value || "—"}
        </p>
      </div>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors border-none bg-transparent cursor-pointer shrink-0"
          title="Copy"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  if (!isOpen || !product) return null;

  const brandName =
    product.brand?.name ||
    product.brand?.name_en ||
    (typeof product.brand === "string" ? product.brand : null) ||
    "No Brand";

  const categoryName =
    categoryLabel(product.category) ||
    categoryLabel(product.level_one_category) ||
    "Uncategorized";

  const l2 = categoryLabel(product.level_two_category);
  const l3 = categoryLabel(product.level_three_category);
  const taxonomyPath = [categoryName, l2, l3].filter(Boolean).join(" › ");

  const descriptionEn = product.description_en || product.description || "";
  const descriptionAr = product.description_ar || "";
  const barcode = product.international_barcode || "";
  const unit = product.unit || "";
  const code = product.code || "";
  const stockCount = product.stock ?? (product.in_stock ? 10 : 0);
  const imageSrc = product.is_local_image
    ? `${API_URL}${product.local_image_url}`
    : product.image;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 dark:bg-zinc-950/70 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
          className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="p-2 bg-primary/10 rounded-xl shrink-0">
                <Package className="w-5 h-5 text-primary" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
                  Product Details
                </h2>
                <p className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
                  Full catalog record & inventory snapshot
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors border-none bg-transparent cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1">
            {/* Hero band */}
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-0 border-b border-zinc-100 dark:border-zinc-800">
              <div className="relative aspect-square md:aspect-auto md:min-h-[240px] bg-zinc-50 dark:bg-black/40 border-b md:border-b-0 md:border-e border-zinc-100 dark:border-zinc-800 flex items-center justify-center p-6 group">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={product.name_en}
                    className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <ImageIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
                )}

                <div className="absolute top-3 start-3 end-3 flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-md border shadow-sm backdrop-blur-md uppercase tracking-wide",
                      product.is_local_image
                        ? "bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-50/95 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {product.is_local_image ? "Local Image" : "CDN Image"}
                  </span>
                  {product.need_prescription && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border shadow-sm backdrop-blur-md uppercase tracking-wide bg-rose-50/95 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400">
                      <ShieldAlert className="w-3 h-3" />
                      Rx
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md uppercase tracking-wide">
                      {brandName}
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md uppercase tracking-wide">
                      {categoryName}
                    </span>
                    {unit && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 bg-primary/10 text-primary rounded-md uppercase tracking-wide">
                        {unit}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 leading-snug">
                      {product.name_en}
                    </h3>
                    {product.name_ar && (
                      <p
                        className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 leading-relaxed"
                        dir="rtl"
                      >
                        {product.name_ar}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Catalog Price
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold text-primary tabular-nums">
                        {product.price?.toLocaleString?.() ?? product.price}
                      </span>
                      <span className="text-sm font-bold text-zinc-500">EGP</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase border",
                        product.in_stock
                          ? "bg-success/10 border-success/20 text-success"
                          : "bg-error/10 border-error/20 text-error"
                      )}
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
                      {stockCount} remaining
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Specs */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
                  Identifiers & Classification
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SpecRow
                    icon={Barcode}
                    label="System SKU"
                    value={product.sku}
                    mono
                    copyable={product.sku}
                  />
                  <SpecRow
                    icon={Hash}
                    label="Product Code"
                    value={code || "—"}
                    mono
                    copyable={code || undefined}
                  />
                  <SpecRow
                    icon={Barcode}
                    label="International Barcode"
                    value={barcode || "Not set"}
                    mono
                    copyable={barcode || undefined}
                  />
                  <SpecRow icon={Tag} label="Manufacturer / Brand" value={brandName} />
                  <SpecRow
                    icon={FolderTree}
                    label="Category Path"
                    value={taxonomyPath}
                  />
                  <SpecRow
                    icon={Layers}
                    label="Unit / Pack"
                    value={unit || "—"}
                  />
                </div>
              </div>

              {/* Descriptions */}
              {(descriptionEn || descriptionAr) && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
                    Descriptions
                  </h4>
                  <div className="space-y-3">
                    {descriptionEn && (
                      <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/30">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                          English
                        </p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {descriptionEn}
                        </p>
                      </div>
                    )}
                    {descriptionAr && (
                      <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/30">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                          Arabic
                        </p>
                        <p
                          className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap"
                          dir="rtl"
                        >
                          {descriptionAr}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!descriptionEn && !descriptionAr && (
                <div className="p-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                  <p className="text-xs text-zinc-400 font-medium">
                    No product description available in the catalog for this item.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-zinc-50 dark:bg-black/30 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 flex-wrap shrink-0">
            <div className="flex items-center gap-3 flex-wrap text-xs font-semibold text-zinc-500">
              <span>
                ID:{" "}
                <code className="bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                  {product.id}
                </code>
              </span>
              {product.source && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-zinc-500">
                  {product.source}
                </span>
              )}
            </div>
            {product.share_link && (
              <a
                href={product.share_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark hover:shadow-primary/30 transition-all group/btn"
              >
                Open on Chefaa
                <ExternalLink className="w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
