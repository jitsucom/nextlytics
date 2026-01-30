import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["nextlytics"],
  async rewrites() {
    return [
      {
        source: "/integrations/:slug.md",
        destination: "/integrations/_md/:slug",
      },
    ];
  },
};

export default nextConfig;
