import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer must not be bundled by the server compiler.
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    // Legacy item images live on the old intranet; allow proxying if referenced.
    remotePatterns: [{ protocol: "https", hostname: "intra.gastro.co.id" }],
  },
};

export default nextConfig;
