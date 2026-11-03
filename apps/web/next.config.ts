import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@launchpad/shared"],
  // Varsayılan ağ: geliştirmede yerel anvil, build'de mainnet. NEXT_PUBLIC_NETWORK ile ezilebilir.
  env: {
    NEXT_PUBLIC_NETWORK:
      process.env.NEXT_PUBLIC_NETWORK ?? (process.env.NODE_ENV === "development" ? "local" : "mainnet"),
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
