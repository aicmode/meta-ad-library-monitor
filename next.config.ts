import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright and better-sqlite3 are native/Node-only and must not be bundled.
  serverExternalPackages: ["playwright", "better-sqlite3"],
  images: {
    // Ad creatives are served from Meta's CDN.
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.xx.fbcdn.net" },
    ],
  },
};

export default nextConfig;
