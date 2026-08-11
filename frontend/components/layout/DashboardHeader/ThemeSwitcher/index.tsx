"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers/ThemeProvider";

export function ThemeSwitcher() {
  const t = useTranslations("Dashboard");
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? t("toggle_theme_light") : t("toggle_theme_dark")}
      title={isDark ? t("toggle_theme_light") : t("toggle_theme_dark")}
    >
      <Icon
        icon={isDark ? "solar:sun-linear" : "solar:moon-linear"}
        className="size-4.5 shrink-0"
      />
    </Button>
  );
}
