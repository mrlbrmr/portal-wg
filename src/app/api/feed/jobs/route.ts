import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_JOB_STATUS_LIST } from "@/lib/job-visibility";
import { buildJobPostingJsonLd } from "@/lib/job-schema";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";

// GET /api/feed/jobs — feed público (JSON) de todas as vagas abertas. Fonte
// legível por máquina reutilizável por agregadores e integrações. Público (sem
// dados de candidato). Revalida a cada 5 min.
export const revalidate = 300;

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiraswg.vercel.app";
  const now = new Date();

  const jobs = await prisma.job.findMany({
    where: {
      status: { in: PUBLIC_JOB_STATUS_LIST },
      OR: [{ closingDate: null }, { closingDate: { gte: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      city: true,
      state: true,
      department: true,
      company: true,
      modality: true,
      contractType: true,
      salaryRange: true,
      createdAt: true,
      closingDate: true,
    },
  });

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
    datePosted: job.createdAt.toISOString(),
    validThrough: job.closingDate ? job.closingDate.toISOString() : null,
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
