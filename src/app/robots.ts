import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiraswg.vercel.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/vagas/", "/privacidade"],
        disallow: [
          "/dashboard",
          "/vagas/gerenciar",
          "/vagas/nova",
          "/configuracoes",
          "/usuarios",
          "/login",
          "/api/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
