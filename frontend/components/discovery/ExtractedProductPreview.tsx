"use client";

import React from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type ExtractedProductData = {
  title_en?: string;
  title_ar?: string;
  price?: number | null;
  image_url?: string;
  images?: string[];
  barcode?: string;
  source_url?: string;
  brand?: string;
  source_domain?: string;
};

function FieldRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export function ExtractedProductCard({ data }: { data: ExtractedProductData }) {
  const t = useTranslations("Discovery");
  const image = data.image_url || data.images?.[0];
  const hasTitle = data.title_en || data.title_ar;

  if (!hasTitle && data.price == null && !image) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        <ImageOff className="h-8 w-8 opacity-50" />
        <p>{t("preview_card_empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-36 shrink-0 flex items-center justify-center bg-muted/30 p-4 border-b sm:border-b-0 sm:border-r border-border">
          {image ? (
            <img src={image} alt="" className="h-28 w-28 object-contain rounded-md bg-white" />
          ) : (
            <div className="h-28 w-28 flex items-center justify-center rounded-md bg-muted/50">
              <ImageOff className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="flex-1 p-4 space-y-2 min-w-0">
          {data.title_en && <h4 className="font-semibold text-base leading-snug">{data.title_en}</h4>}
          {data.title_ar && (
            <p className="text-sm text-muted-foreground leading-relaxed" dir="rtl">
              {data.title_ar}
            </p>
          )}
          {data.price != null && (
            <p className="text-lg font-bold text-primary pt-1">EGP {data.price}</p>
          )}
          <div className="space-y-1 pt-1">
            <FieldRow label={t("try_brand")} value={data.brand} />
            <FieldRow label={t("international_barcode")} value={data.barcode} />
            {!data.barcode && (
              <p className="text-xs text-muted-foreground">{t("barcode_not_found")}</p>
            )}
            <FieldRow label={t("domain")} value={data.source_domain} />
          </div>
          {data.source_url && (
            <a
              href={data.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 truncate max-w-full"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{data.source_url}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExtractedProductJson({ data }: { data: ExtractedProductData }) {
  return (
    <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-auto max-h-96">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function PreviewTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap rounded-lg border border-border p-0.5 bg-muted/30 w-fit gap-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            active === tab.id
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ExtractedProductPreview({ data }: { data: ExtractedProductData | null | undefined }) {
  const t = useTranslations("Discovery");
  const [tab, setTab] = React.useState<"card" | "json">("card");

  if (!data) return null;

  return (
    <div className="space-y-2">
      <PreviewTabBar
        tabs={[
          { id: "card", label: t("preview_tab_card") },
          { id: "json", label: t("preview_tab_json") },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "card" ? <ExtractedProductCard data={data} /> : <ExtractedProductJson data={data} />}
    </div>
  );
}
