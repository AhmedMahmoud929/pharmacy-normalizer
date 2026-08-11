"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const LOCALES = [
  {
    value: "en" as const,
    label: "English",
    flag: "circle-flags:gb",
    nativeName: "English",
  },
  {
    value: "ar" as const,
    label: "Arabic",
    flag: "circle-flags:sa",
    nativeName: "العربية",
  },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const current = LOCALES.find((l) => l.value === locale) ?? LOCALES[0]!;

  const handleSelect = (nextLocale: "en" | "ar") => {
    if (nextLocale === locale) {
      setOpen(false);
      return;
    }
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Language: ${current.label}`}
          className={cn(
            "relative gap-1.5",
            isPending && "pointer-events-none opacity-60"
          )}
        >
          <Icon icon={current.flag} className="size-4.5 shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-48 p-1.5 bg-popover border border-border rounded-2xl shadow-xl overflow-hidden"
      >
        <ul
          className="flex flex-col gap-0.5"
          role="listbox"
          aria-label="Select language"
        >
          {LOCALES.map((loc) => {
            const isActive = loc.value === locale;
            return (
              <li key={loc.value} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => handleSelect(loc.value)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-14 font-medium transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon icon={loc.flag} className="size-5 shrink-0" />
                  <span className="flex-1 text-start">{loc.nativeName}</span>
                  {isActive && (
                    <Icon
                      icon="solar:check-circle-bold"
                      className="size-4 shrink-0 text-primary"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
