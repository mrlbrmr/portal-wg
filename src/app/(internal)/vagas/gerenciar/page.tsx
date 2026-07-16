import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
  Plus,
  Briefcase,
  Users,
  UserPlus,
  CalendarClock,
  UserCheck,
  Timer,
} from "lucide-react";
import { ExportCsvButton } from "@/components/internal/ExportCsvButton";
import { JobsExplorer } from "@/components/internal/JobsExplorer";
import { DashboardCard } from "@/components/internal/DashboardCard";
import { PUBLIC_JOB_STATUS_LIST } from "@/lib/job-visibility";
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
      updatedAt: true,
    },
  });

  // Contagem de candidaturas por vaga
  const appCounts = await prisma.application.groupBy({
    by: ["jobId"],
    _count: { _all: true },
    where: { jobId: { in: jobs.map((j) => j.id) } },
  });
  const countByJob = new Map(appCounts.map((c) => [c.jobId, c._count._all]));

  // ── Métricas da faixa superior (dashboard) ──────────────────────────────
  // Contadas direto no banco (não limitadas às 200 linhas carregadas).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [openJobs, totalCandidates, newToday, inInterview, hired, closedHistory] =
    await Promise.all([
      prisma.job.count({ where: { status: { in: PUBLIC_JOB_STATUS_LIST } } }),
      prisma.application.count(),
      prisma.application.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.application.count({ where: { stage: "INTERVIEW" } }),
      prisma.application.count({ where: { stage: "HIRED" } }),
      prisma.jobStatusHistory.findMany({
        where: { status: "CLOSED" },
        orderBy: { changedAt: "asc" },
        select: {
          jobId: true,
          changedAt: true,
          job: { select: { createdAt: true } },
        },
      }),
    ]);

  // Tempo médio p/ fechamento: dias entre a criação da vaga e o 1º encerramento
  // (CLOSED), média sobre as vagas já encerradas. Deriva de JobStatusHistory.
  const firstClosePerJob = new Map<string, { changedAt: Date; createdAt: Date }>();
  for (const h of closedHistory) {
    if (!firstClosePerJob.has(h.jobId)) {
      firstClosePerJob.set(h.jobId, {
        changedAt: h.changedAt,
        createdAt: h.job.createdAt,
      });
    }
  }
  const closeDurations = Array.from(firstClosePerJob.values()).map(
    ({ changedAt, createdAt }) =>
      (changedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const avgDaysToClose =
    closeDurations.length > 0
      ? Math.round(
          closeDurations.reduce((a, b) => a + b, 0) / closeDurations.length
        )
      : null;

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
    updatedAt: job.updatedAt.toISOString(),
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

      {/* Faixa de indicadores (dashboard superior) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <DashboardCard
          label="Vagas abertas"
          value={openJobs}
          icon={Briefcase}
          iconClass="bg-wg-green/15 text-wg-green-dark"
          hint="visíveis no portal"
          href="/vagas/gerenciar?view=kanban"
        />
        <DashboardCard
          label="Candidatos"
          value={totalCandidates}
          icon={Users}
          iconClass="bg-blue-100 text-blue-600"
          hint="total recebido"
        />
        <DashboardCard
          label="Novos hoje"
          value={newToday}
          icon={UserPlus}
          iconClass="bg-cyan-100 text-cyan-600"
          hint="candidaturas de hoje"
        />
        <DashboardCard
          label="Em entrevista"
          value={inInterview}
          icon={CalendarClock}
          iconClass="bg-purple-100 text-purple-600"
          hint="candidatos nesta etapa"
        />
        <DashboardCard
          label="Admissões"
          value={hired}
          icon={UserCheck}
          iconClass="bg-emerald-100 text-emerald-600"
          hint="candidatos contratados"
        />
        <DashboardCard
          label="Tempo p/ fechar"
          value={avgDaysToClose === null ? "—" : `${avgDaysToClose}d`}
          icon={Timer}
          iconClass="bg-amber-100 text-amber-600"
          hint={
            avgDaysToClose === null ? "sem histórico" : "média por vaga fechada"
          }
        />
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
