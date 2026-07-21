import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase/anon";
import { onlyPublicVisible } from "@/lib/jobs-query";
import { getAppBaseUrl } from "@/lib/app-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppBaseUrl();

  const supabase = createAnonClient();
  const { data } = await onlyPublicVisible(supabase.from("jobs").select("id, slug, updatedAt"));
  const jobs = (data ?? []) as unknown as { id: string; slug: string | null; updatedAt: string }[];

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
