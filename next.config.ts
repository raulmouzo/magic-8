import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone reach `next dev` (over the local network or a Cloudflare
  // quick tunnel) to test motion sensors over HTTPS. Only affects development.
  allowedDevOrigins: ["192.168.*.*", "*.trycloudflare.com"],
};

export default nextConfig;
