import type { NextConfig } from "next";

// Building for the Capacitor Android APK requires a static export (no Node
// server). Regular web/Docker builds keep the standalone server output.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  output: isCapacitorBuild ? "export" : "standalone",
  images: isCapacitorBuild ? { unoptimized: true } : undefined,
  // Line-ending (CRLF) lint errors from this Windows checkout shouldn't block
  // production builds — `npm run lint` still surfaces them separately.
  eslint: { ignoreDuringBuilds: true },
  // JsSIP uses browser APIs — ensure it's only bundled client-side
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle jssip on the server
      config.externals = [...(config.externals || []), "jssip"];
    }
    return config;
  },
};

export default nextConfig;
