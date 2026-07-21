import { createClient } from "@/lib/supabase/server";
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

  // ── Métricas da faixa superior (dashboard) ──────────────────────────────
  // Contadas direto no banco (não limitadas às 200 linhas carregadas).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Uma única ida ao banco: a base de vagas (pesquisa/filtro/ordenação
  // acontecem no cliente, no JobsExplorer), a contagem de candidaturas por
  // vaga e as métricas do topo rodam todas em paralelo.
  const supabase = await createClient();
  const startOfTodayIso = startOfToday.toISOString();

  const [
    jobsRes,
    appRowsRes,
    openJobsRes,
    totalRes,
    newTodayRes,
    interviewRes,
    hiredRes,
    closedRes,
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, title, city, state, isTalentPool, modality, contractType, department, responsible, status, priority, slug, createdAt, updatedAt"
      )
      .order("createdAt", { ascending: false })
      .limit(200),
    supabase.from("applications").select("jobId"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .in("status", PUBLIC_JOB_STATUS_LIST as readonly string[]),
    supabase.from("applications").select("*", { count: "exact", head: true }),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .gte("createdAt", startOfTodayIso),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("stageId", "INTERVIEW"),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("stageId", "HIRED"),
    supabase
      .from("job_status_history")
      .select("jobId, changedAt, job:jobs(createdAt, isTalentPool)")
      .in("status", ["CLOSED", "FILLED"])
      .order("changedAt", { ascending: true }),
  ]);

  const jobs = (jobsRes.data ?? []) as Array<{
    id: string;
    title: string;
    city: string | null;
    state: string | null;
    isTalentPool: boolean;
    modality: string;
    contractType: string;
    department: string | null;
    responsible: string | null;
    status: string;
    priority: string;
    slug: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  const openJobs = openJobsRes.count ?? 0;
  const totalCandidates = totalRes.count ?? 0;
  const newToday = newTodayRes.count ?? 0;
  const inInterview = interviewRes.count ?? 0;
  const hired = hiredRes.count ?? 0;

  // Contagem de candidaturas por vaga (groupBy manual — supabase-js não agrega).
  const countByJob = new Map<string, number>();
  for (const a of (appRowsRes.data ?? []) as Array<{ jobId: string }>) {
    countByJob.set(a.jobId, (countByJob.get(a.jobId) ?? 0) + 1);
  }

  // Tempo médio p/ fechamento: dias entre a criação da vaga e o 1º encerramento
  // (CLOSED ou FILLED), média sobre as vagas já encerradas/finalizadas. Deriva
  // de JobStatusHistory.
  const closedHistory = (closedRes.data ?? []) as unknown as Array<{
    jobId: string;
    changedAt: string;
    job: { createdAt: string; isTalentPool: boolean } | null;
  }>;
  const firstClosePerJob = new Map<string, { changedAt: string; createdAt: string }>();
  for (const h of closedHistory) {
    if (!firstClosePerJob.has(h.jobId) && h.job && !h.job.isTalentPool) {
      firstClosePerJob.set(h.jobId, {
        changedAt: h.changedAt,
        createdAt: h.job.createdAt,
      });
    }
  }
  const closeDurations = Array.from(firstClosePerJob.values()).map(
    ({ changedAt, createdAt }) =>
      (new Date(changedAt).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const avgDaysToClose =
    closeDurations.length > 0
      ? Math.round(
          closeDurations.reduce((a, b) => a + b, 0) / closeDurations.length
        )
      : null;

  const rows = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    city: job.city,
    state: job.state,
    isTalentPool: job.isTalentPool,
    modality: job.modality,
    contractType: job.contractType,
    department: job.department,
    responsible: job.responsible,
    status: job.status,
    priority: job.priority,
    slug: job.slug,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
    candidateCount: countByJob.get(job.id) ?? 0,
  })) as JobRow[];

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
