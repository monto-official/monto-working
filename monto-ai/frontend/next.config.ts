import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export required for Capacitor APK
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Skip ESLint during build (formatting-only errors shouldn't block APK generation)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
