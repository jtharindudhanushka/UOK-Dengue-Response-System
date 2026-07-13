import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Next.js 16 uses Turbopack by default — no webpack config needed
  // Leaflet's browser-only globals are handled by the ssr:false dynamic import
  turbopack: {},
};

export default nextConfig;
