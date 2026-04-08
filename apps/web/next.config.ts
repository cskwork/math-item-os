import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@math-item-os/db",
    "@math-item-os/shared",
    "@math-item-os/math-parser",
  ],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
