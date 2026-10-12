import type { MetadataRoute } from "next";
import { locales } from "@/i18n/locales";
import { SITE_URL } from "@/lib/site";

// The home page in each language, each listing the others.
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((locale) => [locale, `${SITE_URL}/${locale}`]));
  return locales.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    changeFrequency: "monthly",
    priority: 1,
    alternates: { languages },
  }));
}
