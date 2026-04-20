import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@math-item-os/db",
    "@math-item-os/shared",
    "@math-item-os/math-parser",
  ],
  typedRoutes: true,
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
