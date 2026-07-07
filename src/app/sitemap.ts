import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiraswg.vercel.app";

  const jobs = await prisma.job.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ closingDate: null }, { closingDate: { gte: new Date() } }],
    },
    select: { id: true, slug: true, updatedAt: true },
  });

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...jobs.map((job) => ({
      url: `${baseUrl}/vagas/${job.slug ?? job.id}`,
      lastModified: job.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
