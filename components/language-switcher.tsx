"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useDictionary } from "@/components/dictionary-provider";
import { type Locale, locales } from "@/i18n/locales";

// Each name in its own language, for screen readers and tooltips.
const NAMES: Record<Locale, string> = { en: "English", es: "Español", gl: "Galego" };

/** The language codes as plain links; the current one is brighter. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { languageSwitcher: t } = useDictionary();
  const { lang } = useParams<{ lang: string }>();

  return (
    <nav
      aria-label={t.label}
      className={`flex gap-2 text-[10px] tracking-[0.2em] uppercase select-none ${className}`}
    >
      {locales.map((locale) =>
        locale === lang ? (
          <span key={locale} lang={locale} aria-label={NAMES[locale]} aria-current="page" className="text-violet-100/80">
            {locale}
          </span>
        ) : (
          // Each language has its own root layout, so this is a full page load.
          <Link
            key={locale}
            href={`/${locale}`}
            hrefLang={locale}
            lang={locale}
            aria-label={NAMES[locale]}
            title={NAMES[locale]}
            className="text-violet-200/30 transition hover:text-violet-200/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          >
            {locale}
          </Link>
        ),
      )}
    </nav>
  );
}
