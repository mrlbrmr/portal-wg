import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ExportCsvButton } from "@/components/internal/ExportCsvButton";
import { JobsExplorer } from "@/components/internal/JobsExplorer";
import type { JobRow } from "@/types/jobs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gerenciar Vagas — RH" };

export default async function GerenciarVagasPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; status?: string; view?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const canManage = session?.user.role === "ADMIN_RH";

  // Busca a base de vagas; pesquisa/filtro/ordenação acontecem no cliente
  // (JobsExplorer) para uma experiência instantânea. Ordem inicial: mais recentes.
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      city: true,
      state: true,
      modality: true,
      contractType: true,
      department: true,
      responsible: true,
      status: true,
      priority: true,
      slug: true,
      createdAt: true,
    },
  });

  // Contagem de candidaturas por vaga
  const appCounts = await prisma.application.groupBy({
    by: ["jobId"],
    _count: { _all: true },
    where: { jobId: { in: jobs.map((j) => j.id) } },
  });
  const countByJob = new Map(appCounts.map((c) => [c.jobId, c._count._all]));

  const rows: JobRow[] = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    city: job.city,
    state: job.state,
    modality: job.modality,
    contractType: job.contractType,
    department: job.department,
    responsible: job.responsible,
    status: job.status,
    priority: job.priority,
    slug: job.slug,
    createdAt: job.createdAt.toISOString(),
    candidateCount: countByJob.get(job.id) ?? 0,
  }));

  const initialView = params.view === "kanban" ? "kanban" : "list";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Vagas</h1>
        <div className="flex items-center gap-2">
          <ExportCsvButton status={params.status} />
          {canManage && (
            <Link
              href="/vagas/nova"
              className="flex items-center gap-2 rounded-lg bg-wg-green px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-wg-green-bright"
            >
              <Plus className="h-4 w-4" />
              Nova vaga
            </Link>
          )}
        </div>
      </div>

      <JobsExplorer
        jobs={rows}
        canManage={canManage}
        initialView={initialView}
        initialStatus={params.status ?? ""}
        initialSort={params.sort ?? "date_desc"}
      />
    </div>
  );
}
