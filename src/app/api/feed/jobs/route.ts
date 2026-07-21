import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_JOB_STATUS_LIST } from "@/lib/job-visibility";
import { getAppBaseUrl } from "@/lib/app-url";
import { buildJobPostingJsonLd, type JobForSchema } from "@/lib/job-schema";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";

// GET /api/feed/jobs — feed público (JSON) de todas as vagas abertas. Fonte
// legível por máquina reutilizável por agregadores e integrações. Público (sem
// dados de candidato). Revalida a cada 5 min.
export const revalidate = 300;

type FeedJob = JobForSchema & { contractType: string };

export async function GET() {
  const baseUrl = getAppBaseUrl();
  const now = new Date();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, title, slug, description, city, state, department, company, modality, contractType, salaryRange, createdAt, closingDate"
    )
    .in("status", PUBLIC_JOB_STATUS_LIST as readonly string[])
    .or(`closingDate.is.null,closingDate.gte.${now.toISOString()}`)
    .order("createdAt", { ascending: false });

  const jobs = (data ?? []) as FeedJob[];

  const items = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    url: `${baseUrl}/vagas/${job.slug ?? job.id}`,
    company: job.company ?? "Grupo WG Baterias",
    department: job.department,
    city: job.city,
    state: job.state,
    country: "BR",
    modality: MODALITY_LABELS[job.modality] ?? job.modality,
    contractType: CONTRACT_TYPE_LABELS[job.contractType] ?? job.contractType,
    salaryRange: job.salaryRange,
    datePosted: new Date(job.createdAt).toISOString(),
    validThrough: job.closingDate ? new Date(job.closingDate).toISOString() : null,
    jsonLd: buildJobPostingJsonLd(job, baseUrl),
  }));

  return NextResponse.json(
    {
      source: "Portal de Carreiras — Grupo WG",
      generatedAt: now.toISOString(),
      count: items.length,
      jobs: items,
    },
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    }
  );
}
