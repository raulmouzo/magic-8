import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { lang } from "next/root-params";
import { DictionaryProvider } from "@/components/dictionary-provider";
import { SiteNotice } from "@/components/site-notice";
import { type Locale, locales } from "@/i18n/locales";
import { AUTHOR, BACKGROUND, OG_LOCALES, SITE_NAME, SITE_URL } from "@/lib/site";
import { getSiteNotice } from "@/lib/site-notice";
import { getDictionary } from "./dictionaries";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// One static build per language; any other first segment is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }));
}

// Shared by every page in a language; the canonical URL and its alternates
// are set by the home page, the only one to index.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await lang();
  const { metadata } = await getDictionary();
  return {
    metadataBase: new URL(SITE_URL),
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    applicationName: SITE_NAME,
    authors: [AUTHOR],
    creator: AUTHOR.name,
    // The image comes from opengraph-image.tsx; Next.js uses it for X too.
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: metadata.title,
      description: metadata.description,
      url: `/${locale}`,
      locale: OG_LOCALES[locale as Locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => OG_LOCALES[l]),
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
    },
    // Added to the home screen: full screen, content under the status bar.
    appleWebApp: {
      capable: true,
      title: "Magic 8",
      statusBarStyle: "black-translucent",
    },
    // Stops iOS from turning numbers in answers into phone links.
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  // The page background (and AeroShards' default), so the browser bars blend in.
  themeColor: BACKGROUND,
  colorScheme: "dark",
  // Draw under the notch and home indicator; the layout pads with
  // env(safe-area-inset-*), which is 0 without this.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  // Read at build time, like the AI key: a changed notice needs a redeploy.
  const notice = getSiteNotice();
  return (
    <html
      lang={await lang()}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DictionaryProvider dictionary={await getDictionary()}>{children}</DictionaryProvider>
        {notice && <SiteNotice {...notice} />}
      </body>
    </html>
  );
}
