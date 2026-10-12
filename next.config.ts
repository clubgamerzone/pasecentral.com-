import type { NextConfig } from "next";
const config: NextConfig = {
  // Demo data and secrets must never enter serverless/standalone build artifacts.
  outputFileTracingExcludes: {
    "/*": [
      "./.local/**",
      "./.env*",
      "./test-results/**",
      "./playwright-report/**",
    ],
  },
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
