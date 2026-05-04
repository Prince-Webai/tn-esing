import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow pdfjs-dist worker to be loaded
  webpack: (config) => {
    config.resolve.alias['canvas'] = false
    return config
  },
  // Turbopack configuration
  turbopack: {},
  // Server-side packages that should not be bundled for client
  serverExternalPackages: ['pdf-lib'],
}

export default nextConfig;
