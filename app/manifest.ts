import type { MetadataRoute } from "next";
import { BACKGROUND, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE_NAME,
    short_name: "Magic 8",
    description: "A 3D Magic 8 Ball: ask a yes-or-no question and shake your phone.",
    start_url: "/",
    display: "standalone",
    categories: ["entertainment", "games"],
    // The page background, so the launch screen matches the app.
    background_color: BACKGROUND,
    theme_color: BACKGROUND,
    // "any" is the ball alone; "maskable" puts it on the background, inside
    // the safe zone. Both are rendered from app/icon.svg.
    icons: [192, 512].flatMap((size) => [
      { src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" as const },
      {
        src: `/icon-maskable-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "maskable" as const,
      },
    ]),
  };
}
