import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  experimental: {
    cpus: Number(process.env.NEXT_BUILD_CPUS ?? "1"),
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
