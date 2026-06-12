import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
