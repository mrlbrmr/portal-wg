import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { JOB_STATUS_LABELS, MODALITY_LABELS, formatDate, isPublicJobStatus } from "@/lib/utils";
import { Plus, ExternalLink, Users, List, LayoutGrid } from "lucide-react";
import { JobActions } from "@/components/internal/JobActions";
import { JobSortFilter } from "@/components/internal/JobSortFilter";
import { DuplicateJobButton } from "@/components/internal/DuplicateJobButton";
import { ExportCsvButton } from "@/components/internal/ExportCsvButton";
import { JobKanbanBoard, type KanbanJob } from "@/components/internal/JobKanbanBoard";
import type { Metadata } from "next";
import { JobStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Gerenciar Vagas — RH" };

type OrderBy =
  | { createdAt: "asc" | "desc" }
  | { city: "asc" | "desc" }
  | { state: "asc" | "desc" }
  | { title: "asc" | "desc" };

const SORT_MAP: Record<string, OrderBy> = {
  date_desc: { createdAt: "desc" },
  date_asc:  { createdAt: "asc" },
  city_asc:  { city: "asc" },
  state_asc: { state: "asc" },
  title_asc: { title: "asc" },
};

export default async function GerenciarVagasPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; status?: string; view?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);

  const sortKey = params.sort && SORT_MAP[params.sort] ? params.sort : "date_desc";
  const orderBy = SORT_MAP[sortKey];
  const view = params.view === "kanban" ? "kanban" : "list";

  const where: Record<string, unknown> = {};
  const rawStatus = params.status;
  // No Kanban as colunas SÃO os status — não aplicamos o filtro de status.
  if (view !== "kanban" && rawStatus && Object.values(JobStatus).includes(rawStatus as JobStatus)) {
    where.status = rawStatus as JobStatus;
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy,
    take: 200,
  });

  // Contagem de candidaturas por vaga (para o link "Candidatos")
  const appCounts = await prisma.application.groupBy({
    by: ["jobId"],
    _count: { _all: true },
    where: { jobId: { in: jobs.map((j) => j.id) } },
  });
  const countByJob = new Map(appCounts.map((c) => [c.jobId, c._count._all]));

  const kanbanJobs: KanbanJob[] = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    city: job.city,
    state: job.state,
    modality: job.modality,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    candidateCount: countByJob.get(job.id) ?? 0,
  }));
  const canManage = session?.user.role === "ADMIN_RH";

  // Preserva o sort atual nos links do alternador de visão
  const toggleQS = (v: "list" | "kanban") =>
    `/vagas/gerenciar?view=${v}&sort=${sortKey}`;

  const statusBadge: Record<string, string> = {
    DRAFT: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-wg-green/15 text-wg-green-dark",
    SCREENING: "bg-amber-100 text-amber-700",
    INTERVIEW: "bg-purple-100 text-purple-700",
    ADMISSION: "bg-cyan-100 text-cyan-700",
    PAUSED: "bg-orange-100 text-orange-700",
    CLOSED: "bg-gray-200 text-gray-600",
  };

  return (
    <div className={view === "kanban" ? "" : "max-w-4xl"}>
      <div className="flex items-center justify-between mb-5 gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Vagas</h1>
        <div className="flex items-center gap-2">
          <ExportCsvButton status={params.status} />
          {session?.user.role === "ADMIN_RH" && (
            <Link
              href="/vagas/nova"
              className="flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova vaga
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <JobSortFilter />
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {jobs.length} {jobs.length === 1 ? "vaga" : "vagas"}
          </span>
          {/* Alternador Lista / Kanban */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5">
            <Link
              href={toggleQS("list")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === "list" ? "bg-wg-green/15 text-wg-green-dark" : "text-gray-500 hover:text-gray-900"
              }`}
              title="Ver em lista"
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </Link>
            <Link
              href={toggleQS("kanban")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === "kanban" ? "bg-wg-green/15 text-wg-green-dark" : "text-gray-500 hover:text-gray-900"
              }`}
              title="Ver em Kanban por status"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </Link>
          </div>
        </div>
      </div>

      {view === "kanban" ? (
        jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">Nenhuma vaga encontrada.</div>
        ) : (
          <JobKanbanBoard jobs={kanbanJobs} canManage={canManage} />
        )
      ) : (
      <div className="flex flex-col gap-3">
        {jobs.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            Nenhuma vaga encontrada.
          </div>
        )}

        {jobs.map((job) => (
          <div
            key={job.id}
            className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex items-start justify-between gap-4 hover:border-wg-green/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-semibold text-gray-900">{job.title}</h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[job.status]}`}
                >
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </div>
              <div className="text-sm text-gray-500 flex flex-wrap gap-3">
                <span>{job.city} / {job.state}</span>
                <span>·</span>
                <span>{MODALITY_LABELS[job.modality]}</span>
                {job.department && (
                  <>
                    <span>·</span>
                    <span>{job.department}</span>
                  </>
                )}
                <span>·</span>
                <span>Criada em {formatDate(job.createdAt)}</span>
              </div>
              {job.responsible && (
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-gray-500">👤 {job.responsible}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                href={`/vagas/${job.id}/candidatos`}
                className="flex items-center gap-1.5 text-sm border border-gray-300 hover:border-wg-green text-gray-600 hover:text-wg-green-dark px-3 py-1.5 rounded-lg transition-colors"
                title="Ver candidatos"
              >
                <Users className="w-4 h-4" />
                <span>{countByJob.get(job.id) ?? 0}</span>
              </Link>
              {isPublicJobStatus(job.status) && (
                <Link
                  href={`/vagas/${job.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-wg-green-dark transition-colors"
                  title="Ver vaga pública"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              )}

              {session?.user.role === "ADMIN_RH" && (
                <>
                  <Link
                    href={`/vagas/${job.id}/editar`}
                    className="text-sm border border-gray-300 hover:border-wg-green text-gray-600 hover:text-wg-green-dark px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Editar
                  </Link>
                  <DuplicateJobButton jobId={job.id} jobTitle={job.title} />
                  <JobActions
                    jobId={job.id}
                    jobTitle={job.title}
                    status={job.status}
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
