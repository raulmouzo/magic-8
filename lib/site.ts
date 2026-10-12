import type { Locale } from "@/i18n/locales";

// Where the app is deployed; absolute URLs (canonical, Open Graph, sitemap)
// are built from it.
export const SITE_URL = "https://m8.raulmouzo.com";
export const SITE_NAME = "Magic 8 Ball";
export const REPO_URL = "https://github.com/raulmouzo/magic-8";

export const AUTHOR = { name: "Raúl Mouzo", url: "https://raulmouzo.com" };

// The page background, also used for the browser bars and the launch screen.
export const BACKGROUND = "#120F17";

// Open Graph wants language_TERRITORY.
export const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  gl: "gl_ES",
};
