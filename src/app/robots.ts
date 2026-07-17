import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiras.wgbaterias.com.br";
  return {
    rules: [
      {
        userAgent: "*",
        // /api/feed/ liberado (feeds de vagas p/ Indeed e agregadores);
        // regra mais específica que o disallow /api/ genérico.
        allow: ["/", "/vagas/", "/privacidade", "/api/feed/"],
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
