"use client";

import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function DevHelpLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const main = document.querySelector("[data-dashboard-shell] main");
    const inner = main?.firstElementChild as HTMLElement | null;
    if (!main || !inner) return;

    main.classList.add("overflow-hidden");
    inner.classList.add("h-full", "min-h-0", "overflow-hidden", "flex", "flex-col", "!p-0");

    return () => {
      main.classList.remove("overflow-hidden");
      inner.classList.remove("h-full", "min-h-0", "overflow-hidden", "flex", "flex-col", "!p-0");
    };
  }, []);

  return (
    <ScrollArea
      data-dev-help-scroll
      className={cn(
        "h-full flex-1",
        "[&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-2"
      )}
    >
      <div className="mx-auto w-full min-w-0 max-w-[1600px] p-4 md:p-6 lg:p-8">
        {children}
      </div>
    </ScrollArea>
  );
}
