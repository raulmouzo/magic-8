import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { lang } from "next/root-params";
import { DictionaryProvider } from "@/components/dictionary-provider";
import { SiteNotice } from "@/components/site-notice";
import { locales } from "@/i18n/locales";
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

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = await getDictionary();
  return {
    title: metadata.title,
    description: metadata.description,
    applicationName: "Magic 8 Ball",
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
  themeColor: "#120F17",
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
