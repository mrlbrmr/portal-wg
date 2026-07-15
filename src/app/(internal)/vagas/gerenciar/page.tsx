import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { JOB_STATUS_LABELS, MODALITY_LABELS, formatDate, isPublicJobStatus } from "@/lib/utils";
import { Plus, ExternalLink, Link2, Users, List, LayoutGrid } from "lucide-react";
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
    applyMode: job.applyMode,
    createdAt: job.createdAt.toISOString(),
    candidateCount: countByJob.get(job.id) ?? 0,
  }));
  const canManage = session?.user.role === "ADMIN_RH";

  // Preserva o sort atual nos links do alternador de visão
  const toggleQS = (v: "list" | "kanban") =>
    `/vagas/gerenciar?view=${v}&sort=${sortKey}`;

  const statusBadge: Record<string, string> = {
    DRAFT: "bg-blue-500/10 text-blue-400",
    ACTIVE: "bg-wg-green/10 text-wg-green",
    SCREENING: "bg-amber-500/10 text-amber-400",
    INTERVIEW: "bg-purple-500/10 text-purple-400",
    ADMISSION: "bg-cyan-500/10 text-cyan-400",
    PAUSED: "bg-orange-500/10 text-orange-400",
    CLOSED: "bg-wg-border text-wg-gray",
  };

  return (
    <div className={view === "kanban" ? "" : "max-w-4xl"}>
      <div className="flex items-center justify-between mb-5 gap-3">
        <h1 className="text-2xl font-bold text-white">Vagas</h1>
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
          <span className="text-xs text-wg-gray">
            {jobs.length} {jobs.length === 1 ? "vaga" : "vagas"}
          </span>
          {/* Alternador Lista / Kanban */}
          <div className="flex items-center bg-wg-card border border-wg-border rounded-lg p-0.5">
            <Link
              href={toggleQS("list")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === "list" ? "bg-wg-green/15 text-wg-green" : "text-wg-gray hover:text-white"
              }`}
              title="Ver em lista"
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </Link>
            <Link
              href={toggleQS("kanban")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === "kanban" ? "bg-wg-green/15 text-wg-green" : "text-wg-gray hover:text-white"
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
          <div className="text-center py-16 text-wg-gray">Nenhuma vaga encontrada.</div>
        ) : (
          <JobKanbanBoard jobs={kanbanJobs} canManage={canManage} />
        )
      ) : (
      <div className="flex flex-col gap-3">
        {jobs.length === 0 && (
          <div className="text-center py-16 text-wg-gray">
            Nenhuma vaga encontrada.
          </div>
        )}

        {jobs.map((job) => (
          <div
            key={job.id}
            className="bg-wg-card border border-wg-border rounded-xl p-5 flex items-start justify-between gap-4 hover:border-wg-green/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-semibold text-white">{job.title}</h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[job.status]}`}
                >
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </div>
              <div className="text-sm text-wg-gray flex flex-wrap gap-3">
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
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                {job.applyMode === "NATIVE" && (
                  <span className="text-xs text-wg-green flex items-center gap-1">✓ Inscrição pelo portal</span>
                )}
                {job.applyMode === "EXTERNAL" && !job.tallyFormUrl && isPublicJobStatus(job.status) && (
                  <p className="text-xs text-yellow-500">⚠ Link do Tally não configurado</p>
                )}
                {job.tallyFormUrl && (
                  <a
                    href={job.tallyFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-wg-gray hover:text-wg-green flex items-center gap-1 transition-colors"
                    title="Abrir formulário Tally"
                  >
                    <Link2 className="w-3 h-3" />
                    Formulário Tally
                  </a>
                )}
                {job.responsible && (
                  <span className="text-xs text-wg-gray">👤 {job.responsible}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {(job.applyMode === "NATIVE" || (countByJob.get(job.id) ?? 0) > 0) && (
                <Link
                  href={`/vagas/${job.id}/candidatos`}
                  className="flex items-center gap-1.5 text-sm border border-wg-border hover:border-wg-green/50 text-wg-gray hover:text-wg-green px-3 py-1.5 rounded-lg transition-colors"
                  title="Ver candidatos"
                >
                  <Users className="w-4 h-4" />
                  <span>{countByJob.get(job.id) ?? 0}</span>
                </Link>
              )}
              {isPublicJobStatus(job.status) && (
                <Link
                  href={`/vagas/${job.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-wg-gray hover:text-wg-green transition-colors"
                  title="Ver vaga pública"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              )}

              {session?.user.role === "ADMIN_RH" && (
                <>
                  <Link
                    href={`/vagas/${job.id}/editar`}
                    className="text-sm border border-wg-border hover:border-wg-green/50 text-wg-gray hover:text-wg-green px-3 py-1.5 rounded-lg transition-colors"
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
