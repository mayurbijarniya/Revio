import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Optimize images from GitHub avatars
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
    ],
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Native tree-sitter modules should be resolved from node_modules at runtime,
  // not bundled into .next server chunks.
  serverExternalPackages: [
    "tree-sitter",
    "tree-sitter-javascript",
    "tree-sitter-typescript",
    "tree-sitter-python",
    "tree-sitter-go",
    "tree-sitter-rust",
    "tree-sitter-java",
    "tree-sitter-ruby",
    "tree-sitter-php",
    "tree-sitter-c-sharp",
    "tree-sitter-cpp",
    "tree-sitter-swift",
  ],

  // Ensure external native parser packages are included in Vercel output tracing.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/tree-sitter/**/*",
      "./node_modules/tree-sitter-javascript/**/*",
      "./node_modules/tree-sitter-typescript/**/*",
      "./node_modules/tree-sitter-python/**/*",
      "./node_modules/tree-sitter-go/**/*",
      "./node_modules/tree-sitter-rust/**/*",
      "./node_modules/tree-sitter-java/**/*",
      "./node_modules/tree-sitter-ruby/**/*",
      "./node_modules/tree-sitter-php/**/*",
      "./node_modules/tree-sitter-c-sharp/**/*",
      "./node_modules/tree-sitter-cpp/**/*",
      "./node_modules/tree-sitter-swift/**/*",
    ],
  },
};

export default nextConfig;
