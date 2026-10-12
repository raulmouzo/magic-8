import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { hasLocale } from "@/i18n/locales";
import { BACKGROUND } from "@/lib/site";
import { getDictionaryFor } from "./dictionaries";

const size = { width: 1200, height: 630 };

// Route handlers can't read the root params, so the language comes in params.
// One image per language, with its alt text in that language.
export async function generateImageMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const { metadata } = await getDictionaryFor(hasLocale(lang) ? lang : "en");
  return [{ id: "card", alt: metadata.ogAlt, size, contentType: "image/png" }];
}

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const { metadata } = await getDictionaryFor(hasLocale(lang) ? lang : "en");
  const [regular, semiBold, icon] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-SemiBold.ttf")),
    readFile(join(process.cwd(), "app/icon.svg")),
  ]);
  const mark = `data:image/svg+xml;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: BACKGROUND,
          color: "#f3e8ff",
          fontFamily: "Geist",
        }}
      >
        {/* The mark, on the right. */}
        <img src={mark} width={480} height={480} style={{ position: "absolute", right: 70, top: 85 }} alt="" />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 80px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 600 }}>
            <img src={mark} width={40} height={40} alt="" />
            Magic 8 Ball
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 660 }}>
            <div style={{ fontSize: 88, fontWeight: 600, letterSpacing: -3, lineHeight: 1.02, textWrap: "balance" }}>
              {metadata.ogHeadline}
            </div>
            <div style={{ fontSize: 34, color: "rgba(221,214,254,0.6)", lineHeight: 1.3 }}>
              {metadata.ogTagline}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, maxWidth: 660 }}>
            <span style={{ color: "rgba(221,214,254,0.5)" }}>m8.raulmouzo.com</span>
            <span style={{ color: "#c084fc", fontWeight: 600 }}>{metadata.ogAnswers}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semiBold, weight: 600, style: "normal" },
      ],
    },
  );
}
