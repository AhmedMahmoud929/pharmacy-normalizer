"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, API_URL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cardSurfaceClass, tableHeaderClass, tableRowClass } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/use-toast";

interface SourceProfile {
  domain: string;
  display_name: string;
  platform: string;
  enabled: boolean;
  priority: number;
  search_config?: Record<string, unknown>;
  extract_config?: Record<string, unknown>;
  sample_url?: string;
  last_test_status?: string;
}

interface PreviewResult {
  domain: string;
  platform: string;
  suggested_search_config: Record<string, unknown>;
  suggested_extract_config: Record<string, string | number | null>;
  available_elements: Array<{ field_hint: string; selector: string; sample_text: string }>;
  extracted_preview?: Record<string, unknown>;
}

const FIELDS = ["name", "price", "image", "barcode"] as const;

export function SourceProfilesPanel() {
  const t = useTranslations("Discovery");
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<SourceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sampleUrl, setSampleUrl] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({
    domain: "",
    display_name: "",
    platform: "custom",
    priority: 100,
    enabled: true,
    name: "h1",
    price: ".price",
    image: "img",
    barcode: "",
    price_divisor: 100,
  });

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sources/profiles`);
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch {
      toast({ title: t("error_load_profiles"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const runPreview = async () => {
    if (!sampleUrl.trim()) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sources/profiles/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sampleUrl.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: PreviewResult = await res.json();
      setPreview(data);
      const ext = data.suggested_extract_config || {};
      setForm((f) => ({
        ...f,
        domain: data.domain,
        display_name: data.domain,
        platform: data.platform,
        name: String(ext.name || f.name),
        price: String(ext.price || f.price),
        image: String(ext.image || f.image),
        barcode: ext.barcode ? String(ext.barcode) : "",
        price_divisor: Number(ext.price_divisor || f.price_divisor),
      }));
    } catch (e) {
      toast({ title: t("error_preview"), description: String(e), variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!form.domain) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/sources/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: form.domain,
          display_name: form.display_name || form.domain,
          platform: form.platform,
          enabled: form.enabled,
          priority: form.priority,
          sample_url: sampleUrl || undefined,
          search_config: preview?.suggested_search_config || {},
          extract_config: {
            name: form.name,
            price: form.price,
            image: form.image,
            barcode: form.barcode || null,
            price_divisor: form.price_divisor,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: t("profile_saved") });
      setPreview(null);
      setSampleUrl("");
      fetchProfiles();
    } catch (e) {
      toast({ title: t("error_save"), description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const testProfile = async () => {
    if (!form.domain || !sampleUrl.trim()) return;
    setTesting(true);
    try {
      await fetch(`${API_URL}/api/sources/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: form.domain,
          display_name: form.display_name || form.domain,
          platform: form.platform,
          enabled: form.enabled,
          priority: form.priority,
          sample_url: sampleUrl,
          search_config: preview?.suggested_search_config || {},
          extract_config: {
            name: form.name,
            price: form.price,
            image: form.image,
            barcode: form.barcode || null,
            price_divisor: form.price_divisor,
          },
        }),
      });
      const res = await fetch(`${API_URL}/api/sources/profiles/${encodeURIComponent(form.domain)}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sampleUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Test failed");
      toast({ title: t("test_ok"), description: JSON.stringify(data.result?.title_en || data.result) });
    } catch (e) {
      toast({ title: t("test_failed"), description: String(e), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const deleteProfile = async (domain: string) => {
    if (domain === "chefaa.com") return;
    try {
      const res = await fetch(`${API_URL}/api/sources/profiles/${encodeURIComponent(domain)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      fetchProfiles();
    } catch (e) {
      toast({ title: t("error_delete"), description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn(cardSurfaceClass, "p-6 space-y-4")}>
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t("add_source")}</h3>
        <p className="text-sm text-muted-foreground">{t("add_source_hint")}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="https://eg.example.com/products/sample-item"
            value={sampleUrl}
            onChange={(e) => setSampleUrl(e.target.value)}
          />
          <Button onClick={runPreview} disabled={previewLoading || !sampleUrl.trim()}>
            {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t("preview")}
          </Button>
        </div>

        {preview && (
          <div className="grid gap-4 md:grid-cols-2 border-t border-border pt-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">
                {t("detected")}: <span className="text-foreground">{preview.platform}</span> · {preview.domain}
              </p>
              {FIELDS.map((field) => (
                <label key={field} className="block text-xs space-y-1">
                  <span className="font-medium uppercase">{field} selector</span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
                    value={String(form[field as keyof typeof form] ?? "")}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  />
                </label>
              ))}
              <label className="block text-xs space-y-1">
                <span className="font-medium">{t("price_divisor")}</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  value={form.price_divisor}
                  onChange={(e) => setForm((f) => ({ ...f, price_divisor: Number(e.target.value) }))}
                />
              </label>
              <label className="block text-xs space-y-1">
                <span className="font-medium">{t("priority")}</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                />
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">{t("extracted_preview")}</p>
              <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-auto max-h-64">
                {JSON.stringify(preview.extracted_preview, null, 2)}
              </pre>
              <div className="flex gap-2">
                <Button variant="outline" onClick={testProfile} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {t("test")}
                </Button>
                <Button onClick={saveProfile} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {t("save_profile")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={cn(cardSurfaceClass, "overflow-hidden")}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold">{t("configured_sources")}</h3>
          <Button variant="ghost" size="sm" onClick={fetchProfiles}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className={tableHeaderClass}>
              <th className="p-3 text-left">{t("domain")}</th>
              <th className="p-3 text-left">{t("platform")}</th>
              <th className="p-3 text-left">{t("priority")}</th>
              <th className="p-3 text-left">{t("status")}</th>
              <th className="p-3" />
            </tr></thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.domain} className={tableRowClass}>
                  <td className="p-3 font-medium">{p.display_name || p.domain}</td>
                  <td className="p-3 capitalize">{p.platform}</td>
                  <td className="p-3">{p.priority}</td>
                  <td className="p-3">
                    {p.enabled ? (
                      <span className="text-emerald-600 text-xs font-bold uppercase">{t("enabled")}</span>
                    ) : (
                      <span className="text-zinc-500 text-xs uppercase">{t("disabled")}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {p.sample_url && (
                      <a href={p.sample_url} target="_blank" rel="noreferrer" className="inline-flex mr-2 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {p.domain !== "chefaa.com" && (
                      <button type="button" onClick={() => deleteProfile(p.domain)} className="text-destructive hover:opacity-80">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
