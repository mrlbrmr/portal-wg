import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // unpdf e pdf-parse precisam rodar em Node.js puro (não bundlados pelo webpack)
  serverExternalPackages: ["unpdf", "pdfjs-dist", "pdf-parse"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // google.com + gstatic.com liberam o script do reCAPTCHA v3 (api.js e deps).
              // unsafe-eval só em desenvolvimento (Next.js usa eval() no hot-reload).
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.google.com https://www.gstatic.com`,
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
