import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Magic 8 Ball",
    short_name: "Magic 8",
    description: "Ask the Magic 8 Ball a question.",
    start_url: "/",
    display: "standalone",
    // The page background, so the launch screen matches the app.
    background_color: "#120F17",
    theme_color: "#120F17",
    // Opaque, with the triangle inside the maskable safe zone.
    icons: [192, 512].flatMap((size) =>
      (["any", "maskable"] as const).map((purpose) => ({
        src: `/icon-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose,
      })),
    ),
  };
}
