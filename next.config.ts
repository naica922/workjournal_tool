import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev-tools badge overlaps the bottom of the navigation rail
  // and intercepts clicks in e2e tests.
  devIndicators: false,
};

export default nextConfig;
