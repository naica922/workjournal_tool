import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev-tools badge overlaps the bottom of the navigation rail
  // and intercepts clicks in e2e tests.
  devIndicators: false,
  // pdfkit loads its built-in font (.afm) files from its own package at
  // runtime; keep it external so the bundler does not break those reads.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
