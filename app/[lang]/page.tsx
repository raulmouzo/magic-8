import type { Metadata } from "next";
import { lang } from "next/root-params";
import { locales } from "@/i18n/locales";
import { getAiGatewayKey } from "@/lib/ai-gateway";
import { AUTHOR, REPO_URL, SITE_NAME, SITE_URL } from "@/lib/site";
import { getDictionary } from "./dictionaries";
import { Home } from "./home";

// One URL per language, each pointing at the others; / picks by the
// browser's language, so it's the default.
export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: {
      canonical: `/${await lang()}`,
      languages: {
        ...Object.fromEntries(locales.map((locale) => [locale, `/${locale}`])),
        "x-default": "/",
      },
    },
  };
}

export default async function Page() {
  const locale = await lang();
  const { metadata } = await getDictionary();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: `${SITE_URL}/${locale}`,
    description: metadata.description,
    inLanguage: locale,
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "Any (runs in the browser)",
    browserRequirements: "Requires JavaScript and WebGL",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    author: { "@type": "Person", ...AUTHOR },
    sameAs: [REPO_URL],
  };

  // Read at build time, so the page stays static; on Vercel a changed key
  // needs a redeploy anyway. A key revoked later is caught by the first
  // question. Only whether it's set reaches the client.
  return (
    <>
      <script
        type="application/ld+json"
        // Escaped so a "</script>" in the texts can't close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Home aiConfigured={getAiGatewayKey() !== null} />
    </>
  );
}
