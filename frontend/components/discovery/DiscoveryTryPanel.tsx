"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleSlash,
  HelpCircle,
  Loader2,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, API_URL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cardSurfaceClass } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/use-toast";

type DiscoveryStatus = "found" | "review" | "not_found";

interface SourceOption {
  domain: string;
  display_name: string;
  platform: string;
}

interface TryStep {
  id: string;
  phase: string;
  message: string;
  detail?: string;
  tone: "info" | "success" | "warning" | "error";
  domain?: string;
  score?: number;
  status?: DiscoveryStatus;
}

interface TryResult {
  original_name: string;
  normalized_name?: string;
  discovery_status: DiscoveryStatus;
  score?: number;
  source_domain?: string;
  source_url?: string;
  title_en?: string;
  title_ar?: string;
  price?: number;
  image_url?: string;
  brand?: string;
  candidates?: Array<Record<string, unknown>>;
}

function StatusBadge({ status }: { status: DiscoveryStatus }) {
  const map: Record<DiscoveryStatus, string> = {
    found: "bg-success/10 text-success border-success/20",
    review: "bg-warning/10 text-warning border-warning/20",
    not_found: "bg-error/10 text-error border-error/20",
  };
  return (
    <span className={cn("px-2 py-1 text-[10px] font-bold uppercase rounded-md border", map[status])}>
      {status.replace("_", " ")}
    </span>
  );
}

function stepTone(phase: string, data: Record<string, unknown>): TryStep["tone"] {
  if (phase.endsWith("_error")) return "error";
  if (phase === "early_exit" || data.status === "found") return "success";
  if (data.status === "review") return "warning";
  if (phase === "search_done" && (data.count as number) === 0) return "warning";
  return "info";
}

async function consumeSseStream(
  response: Response,
  onEvent: (event: string, data: Record<string, unknown>) => void
) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      let event = "message";
      let dataStr = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        if (line.startsWith("data: ")) dataStr = line.slice(6);
      }
      if (dataStr) {
        onEvent(event, JSON.parse(dataStr) as Record<string, unknown>);
      }
    }
  }
}

export function DiscoveryTryPanel() {
  const t = useTranslations("Discovery");
  const { toast } = useToast();

  const [productName, setProductName] = useState("");
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<TryStep[]>([]);
  const [result, setResult] = useState<TryResult | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/discovery/sources`)
      .then((r) => r.json())
      .then((d) => {
        const profiles = d.profiles || [];
        setSources(profiles);
        setSelectedSources(profiles.map((p: SourceOption) => p.domain));
      })
      .catch(() => toast({ title: t("error_load_profiles"), variant: "destructive" }));
  }, [t, toast]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps]);

  const formatStepMessage = (phase: string, data: Record<string, unknown>): { message: string; detail?: string } => {
    const domain = String(data.domain || "");
    switch (phase) {
      case "init":
        if (data.direct_url) {
          return {
            message: t("try_step_url_detected", { query: String(data.search_query || "") }),
            detail: String(data.direct_url),
          };
        }
        return {
          message: t("try_step_init", { count: data.source_count as number }),
          detail: (data.sources as Array<{ display_name?: string; domain: string }> | undefined)
            ?.map((s) => s.display_name || s.domain)
            .join(", "),
        };
      case "direct_extract":
        return {
          message: t("try_step_direct_extract", { domain }),
          detail: String(data.url || ""),
        };
      case "search_start":
        return { message: t("try_step_search_start", { domain, query: String(data.query || "") }) };
      case "search_done":
        return {
          message: t("try_step_search_done", { domain, count: data.count as number }),
          detail: (data.candidates as Array<{ title?: string }> | undefined)
            ?.map((c) => c.title)
            .filter(Boolean)
            .slice(0, 3)
            .join(" · "),
        };
      case "search_error":
        return { message: t("try_step_search_error", { domain }), detail: String(data.error || "") };
      case "extract_start":
        return {
          message: t("try_step_extract_start", { domain }),
          detail: String(data.title || data.url || ""),
        };
      case "extract_done":
        return {
          message: t("try_step_extract_done", {
            domain,
            score: Math.round(((data.score as number) || 0) * 100),
            status: String(data.status || ""),
          }),
          detail: String(data.title_en || data.title_ar || ""),
        };
      case "extract_error":
        return { message: t("try_step_extract_error", { domain }), detail: String(data.error || "") };
      case "best_update":
        return {
          message: t("try_step_best_update", {
            domain,
            score: Math.round(((data.score as number) || 0) * 100),
          }),
          detail: String(data.title_en || ""),
        };
      case "early_exit":
        return {
          message: t("try_step_early_exit", {
            domain,
            score: Math.round(((data.score as number) || 0) * 100),
          }),
        };
      default:
        return { message: phase };
    }
  };

  const appendStep = (phase: string, data: Record<string, unknown>) => {
    const { message, detail } = formatStepMessage(phase, data);
    setSteps((prev) => [
      ...prev,
      {
        id: `${prev.length}-${phase}-${data.domain || "global"}`,
        phase,
        message,
        detail,
        tone: stepTone(phase, data),
        domain: data.domain as string | undefined,
        score: data.score as number | undefined,
        status: data.status as DiscoveryStatus | undefined,
      },
    ]);
  };

  const runTry = async () => {
    const name = productName.trim();
    if (!name) {
      toast({ title: t("try_name_required"), variant: "destructive" });
      return;
    }
    if (selectedSources.length === 0) {
      toast({ title: t("try_sources_required"), variant: "destructive" });
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunning(true);
    setSteps([]);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/discovery/try`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: name,
          source_domains: selectedSources,
          match_threshold: 0.6,
          review_threshold: 0.4,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Request failed");
      }

      await consumeSseStream(res, (event, data) => {
        if (event === "step" && data.phase) {
          appendStep(String(data.phase), data);
        } else if (event === "complete") {
          setResult(data as unknown as TryResult);
        } else if (event === "error") {
          throw new Error(String(data.error || "Discovery failed"));
        }
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      toast({ title: t("try_error"), description: String(e), variant: "destructive" });
      setSteps((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          phase: "error",
          message: t("try_error"),
          detail: String(e),
          tone: "error",
        },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const toneIcon = (tone: TryStep["tone"]) => {
    if (tone === "success") return <CheckCircle2 className="h-4 w-4 text-success shrink-0" />;
    if (tone === "warning") return <HelpCircle className="h-4 w-4 text-warning shrink-0" />;
    if (tone === "error") return <AlertCircle className="h-4 w-4 text-error shrink-0" />;
    return <Search className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  return (
    <div className="space-y-6">
      <div className={cn(cardSurfaceClass, "p-6 space-y-5")}>
        <div>
          <p className="text-sm font-medium">{t("try_heading")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("try_hint")}</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">{t("try_product_name")}</label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder={t("try_product_placeholder")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            disabled={running}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !running) runTry();
            }}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">{t("sources_to_search")}</p>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <label key={s.domain} className="flex items-center gap-1.5 text-sm border rounded-md px-2 py-1">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(s.domain)}
                  disabled={running}
                  onChange={(e) => {
                    setSelectedSources((prev) =>
                      e.target.checked ? [...prev, s.domain] : prev.filter((d) => d !== s.domain)
                    );
                  }}
                />
                {s.display_name || s.domain}
              </label>
            ))}
          </div>
        </div>

        <Button onClick={runTry} disabled={running} className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? t("try_running") : t("try_run")}
        </Button>
      </div>

      {(running || steps.length > 0) && (
        <div className={cn(cardSurfaceClass, "p-6")}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t("try_pipeline")}</h2>
            {running && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex gap-3 rounded-lg border px-3 py-2 text-sm",
                  step.tone === "error" && "border-error/30 bg-error/5",
                  step.tone === "success" && "border-success/30 bg-success/5",
                  step.tone === "warning" && "border-warning/30 bg-warning/5",
                  step.tone === "info" && "border-border bg-muted/20"
                )}
              >
                {toneIcon(step.tone)}
                <div className="min-w-0 flex-1">
                  <p>{step.message}</p>
                  {step.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {result && (
        <div className={cn(cardSurfaceClass, "p-6 space-y-4")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t("try_result")}</p>
              <h3 className="text-lg font-semibold mt-1">{result.title_en || result.original_name}</h3>
              {result.title_ar && <p className="text-sm text-muted-foreground">{result.title_ar}</p>}
            </div>
            <StatusBadge status={result.discovery_status} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {result.image_url && (
              <img
                src={result.image_url}
                alt=""
                className="h-28 w-28 rounded-lg border object-contain bg-white shrink-0"
              />
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t("query")}: </span>
                {result.original_name}
              </div>
              <div>
                <span className="text-muted-foreground">{t("score")}: </span>
                {result.score != null ? `${(result.score * 100).toFixed(0)}%` : "—"}
              </div>
              <div>
                <span className="text-muted-foreground">{t("source")}: </span>
                {result.source_domain || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">{t("try_price")}: </span>
                {result.price != null ? `EGP ${result.price}` : "—"}
              </div>
              {result.brand && (
                <div>
                  <span className="text-muted-foreground">{t("try_brand")}: </span>
                  {result.brand}
                </div>
              )}
              {result.source_url && (
                <div className="col-span-2">
                  <a href={result.source_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">
                    {result.source_url}
                  </a>
                </div>
              )}
            </div>
          </div>

          {(result.candidates?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{t("try_candidates")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3">{t("source")}</th>
                      <th className="py-2 pr-3">{t("result")}</th>
                      <th className="py-2 pr-3">{t("score")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.candidates!.map((c, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-3 text-xs">{String(c.source_domain || "—")}</td>
                        <td className="py-2 pr-3 max-w-[240px] truncate">
                          {String(c.title_en || c.title || "—")}
                          {c.error != null && (
                            <span className="block text-xs text-error">{String(c.error)}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {c.score != null ? `${(Number(c.score) * 100).toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.discovery_status === "not_found" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleSlash className="h-4 w-4" />
              {t("try_not_found_hint")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
