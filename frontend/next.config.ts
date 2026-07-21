import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: [
    "10.59.10.7",
    "169.254.83.107",
    "172.21.64.1",
    "192.168.0.5",
    "buttons-sic-did-yea.trycloudflare.com",
  ],
};

export default nextConfig;

