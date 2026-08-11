import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  // Unprefixed paths = English; only resolve locale from the URL.
  localePrefix: "as-needed",
  localeDetection: false,
});
