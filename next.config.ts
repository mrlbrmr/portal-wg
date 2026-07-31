import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse usa require() do Node.js e não pode ser bundlado pelo webpack
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // google.com + gstatic.com liberam o script do reCAPTCHA v3 (api.js e deps).
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://www.gstatic.com",
              // reCAPTCHA faz requisições a google.com; Supabase (auth/rest/storage/
              // realtime) roda em *.supabase.co (https + wss p/ realtime futuro).
              "connect-src 'self' https://www.google.com https://*.supabase.co wss://*.supabase.co",
              "frame-src 'self' https://www.google.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
