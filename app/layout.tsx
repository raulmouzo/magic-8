import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Magic 8 Ball",
  description: "Ask the Magic 8 Ball a question.",
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

export const viewport: Viewport = {
  // The page background (and AeroShards' default), so the browser bars blend in.
  themeColor: "#120F17",
  colorScheme: "dark",
  // Draw under the notch and home indicator; the layout pads with
  // env(safe-area-inset-*), which is 0 without this.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
