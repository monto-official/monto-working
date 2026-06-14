import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // Pin workspace root to this app's directory
    root: __dirname,
  },
};

export default nextConfig;
