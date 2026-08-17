"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FeatureBadge } from "@/components/shared/FeatureBadge";
import { cardSurfaceClass } from "@/components/ui/stat-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DEV_HELP_SECTIONS, DEV_HELP_TOC } from "@/lib/dev-help-content";

function getScrollViewport() {
  return document.querySelector(
    '[data-dev-help-scroll] [data-slot="scroll-area-viewport"]'
  ) as HTMLElement | null;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <ScrollArea className="rounded-xl border border-zinc-800 bg-zinc-950">
      <ScrollBar orientation="horizontal" />
      <pre className="p-4 text-xs leading-relaxed font-mono text-zinc-100 whitespace-pre">
        {children}
      </pre>
    </ScrollArea>
  );
}

function ItemsList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DevHelpPage() {
  const t = useTranslations("DevHelp");
  const [activeId, setActiveId] = useState(DEV_HELP_TOC[0]?.id ?? "architecture");

  useEffect(() => {
    const root = getScrollViewport();
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { root, rootMargin: "-15% 0px -60% 0px", threshold: [0, 0.25, 0.5] }
    );

    DEV_HELP_TOC.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    setActiveId(id);
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-full min-w-0 pb-16">
      <div className="mb-10 space-y-4 text-start">
        <FeatureBadge icon={BookOpen} label={t("badge")} />
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t("description")}
        </p>
      </div>

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-64 lg:self-start">
          <nav className={cn(cardSurfaceClass, "space-y-1 p-4")}>
            <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
              {t("toc")}
            </p>
            {DEV_HELP_TOC.map(({ id, title }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(id);
                }}
                className={cn(
                  "block rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                  activeId === id
                    ? "bg-primary/10 text-primary"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                {title}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-8">
          {DEV_HELP_SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className={cn(cardSurfaceClass, "scroll-mt-6 space-y-5 p-6 md:p-8")}
            >
              <div className="space-y-2 border-b border-border pb-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {section.title}
                </h2>
                <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {section.summary}
                </p>
              </div>

              {section.bullets && <ItemsList items={section.bullets} />}

              {section.subsections?.map((sub) => (
                <div key={sub.title} className="space-y-2">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    {sub.title}
                  </h3>
                  {sub.content && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{sub.content}</p>
                  )}
                  {sub.items && <ItemsList items={sub.items} />}
                </div>
              ))}

              {section.table && (
                <ScrollArea className="rounded-xl border border-border">
                  <ScrollBar orientation="horizontal" />
                  <table className="w-full min-w-max text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-zinc-50 dark:bg-zinc-950/50">
                        {section.table.headers.map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 font-bold text-zinc-600 dark:text-zinc-300"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className="px-4 py-3 align-top text-zinc-600 dark:text-zinc-400"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}

              {section.code && <CodeBlock>{section.code}</CodeBlock>}

              {section.note && (
                <p className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs font-semibold text-warning">
                  {section.note}
                </p>
              )}
            </section>
          ))}

          <div className={cn(cardSurfaceClass, "p-6 text-sm text-zinc-500 dark:text-zinc-400")}>
            <p>
              {t("footer")}{" "}
              <Link
                href="/dashboard/admin/database"
                className="font-semibold text-primary hover:underline"
              >
                Database Settings
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
