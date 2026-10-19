import type { NextConfig } from "next";

// Local credential/data files must never become serverless deployment assets.
// Patterns are resolved from this project, not from the route's output folder.
const privateTraceExcludes = [
  "./.env*",
  "./**/.env*",
  "./.data/**/*",
  "./.logs/**/*",
  "./.git/**/*",
  "./.vercel/**/*",
  "./tests/**/*",
  "./docs/**/*",
  "./scripts/**/*",
  "./test-results/**/*",
  "./playwright-report/**/*",
  "./graphify-out/**/*",
  "./**/gastro-wms/**/*",
  "./**/gastro-wms/.env*",
];

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["node:sqlite"],
  // Keeping the root here also prevents tracing the sibling WMS checkout.
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: { "/*": privateTraceExcludes },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default config;
