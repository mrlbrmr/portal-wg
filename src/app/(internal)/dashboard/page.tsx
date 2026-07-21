import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Briefcase, PauseCircle, XCircle, Plus, FileText, Clock, Calendar, Users, UserPlus, CheckCircle2, AlertTriangle, CalendarClock } from "lucide-react";
import { PUBLIC_JOB_STATUS_LIST } from "@/lib/job-visibility";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Metadata } from "next";
import type { ElementType } from "react";

export const metadata: Metadata = { title: "Dashboard — RH" };

export default async function DashboardPage() {
  const session = await auth();

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in7UTC = new Date(todayUTC.getTime() + 7 * 86400000);

  const supabase = await createClient();
  const publicStatuses = PUBLIC_JOB_STATUS_LIST as readonly string[];

  const [
    activeJobsRes,
    pausedJobsRes,
    closedJobsRes,
    filledJobsRes,
    draftJobsRes,
    expiringSoonRes,
    openedLongRes,
    thisMonthRes,
    lastMonthRes,
    totalAppsRes,
    newAppsRes,
    admissionsRes,
    recentAdmissionsRes,
    recentJobsRes,
    recentApplicationsRes,
  ] = await Promise.all([
    // "Ativas" = pipeline aberto no portal (Ativa + Triagem + Entrevistas + Admissão)
    supabase.from("jobs").select("*", { count: "exact", head: true }).in("status", publicStatuses),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "PAUSED"),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "CLOSED"),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "FILLED"),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "DRAFT"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .in("status", publicStatuses)
      .gte("closingDate", now.toISOString())
      .lte("closingDate", sevenDaysFromNow.toISOString()),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .in("status", publicStatuses)
      .lte("createdAt", thirtyDaysAgo.toISOString()),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .gte("createdAt", startOfThisMonth.toISOString())
      .lt("createdAt", startOfNextMonth.toISOString()),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .gte("createdAt", startOfLastMonth.toISOString())
      .lt("createdAt", startOfThisMonth.toISOString()),
    supabase.from("applications").select("*", { count: "exact", head: true }),
    supabase.from("applications").select("*", { count: "exact", head: true }).eq("stageId", "NEW"),
    // Admissões: carrega as ativas com o flag isFinal da etapa e computa as
    // 4 métricas no JS (supabase-js não filtra count por coluna de relação).
    supabase
      .from("admissions")
      .select("startDate, stage:admission_stages(isFinal)")
      .is("deletedAt", null),
    supabase
      .from("admissions")
      .select("id, fullName, startDate, position:admission_positions(name), stage:admission_stages(name, color)")
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .limit(5),
    supabase
      .from("jobs")
      .select("id, title, status, city, state, createdAt")
      .order("createdAt", { ascending: false })
      .limit(6),
    supabase
      .from("applications")
      .select("id, fullName, createdAt, jobId, job:jobs(title), stage:application_stages(name, color)")
      .order("createdAt", { ascending: false })
      .limit(5),
  ]);

  const activeJobs = activeJobsRes.count ?? 0;
  const pausedJobs = pausedJobsRes.count ?? 0;
  const closedJobs = closedJobsRes.count ?? 0;
  const filledJobs = filledJobsRes.count ?? 0;
  const draftJobs = draftJobsRes.count ?? 0;
  const expiringSoon = expiringSoonRes.count ?? 0;
  const openedLong = openedLongRes.count ?? 0;
  const thisMonthCount = thisMonthRes.count ?? 0;
  const lastMonthCount = lastMonthRes.count ?? 0;
  const totalApplications = totalAppsRes.count ?? 0;
  const newApplications = newAppsRes.count ?? 0;

  const admissionRows = (admissionsRes.data ?? []) as unknown as Array<{
    startDate: string | null;
    stage: { isFinal: boolean } | null;
  }>;
  const admissionsTotal = admissionRows.length;
  const admissionsDone = admissionRows.filter((a) => a.stage?.isFinal).length;
  const admissionsLate = admissionRows.filter(
    (a) => a.startDate && new Date(a.startDate) < todayUTC && !a.stage?.isFinal
  ).length;
  const admissionsUpcoming = admissionRows.filter(
    (a) => a.startDate && new Date(a.startDate) >= todayUTC && new Date(a.startDate) <= in7UTC
  ).length;

  const admissionsInProgress = admissionsTotal - admissionsDone;

  const recentAdmissions = (recentAdmissionsRes.data ?? []) as unknown as Array<{
    id: string;
    fullName: string;
    startDate: string | null;
    position: { name: string } | null;
    stage: { name: string; color: string } | null;
  }>;

  const recentJobs = (recentJobsRes.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    city: string;
    state: string;
    createdAt: string;
  }>;

  const recentApplications = (recentApplicationsRes.data ?? []) as unknown as Array<{
    id: string;
    fullName: string;
    stage: { name: string; color: string } | null;
    createdAt: string;
    jobId: string;
    job: { title: string } | null;
  }>;

  const statusBadge: Record<string, string> = {
    DRAFT: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-wg-green/15 text-wg-green-dark",
    SCREENING: "bg-amber-100 text-amber-700",
    INTERVIEW: "bg-purple-100 text-purple-700",
    ADMISSION: "bg-cyan-100 text-cyan-700",
    PAUSED: "bg-orange-100 text-orange-700",
    CLOSED: "bg-gray-200 text-gray-600",
    FILLED: "bg-emerald-100 text-emerald-700",
  };
  const statusLabel: Record<string, string> = {
    DRAFT: "Rascunho",
    ACTIVE: "Ativa",
    SCREENING: "Triagem",
    INTERVIEW: "Entrevistas",
    ADMISSION: "Admissão",
    PAUSED: "Pausada",
    CLOSED: "Cancelada",
    FILLED: "Finalizada",
  };


  const stats = [
    {
      label: "Vagas Ativas",
      value: activeJobs,
      icon: Briefcase as ElementType,
      iconClass: "bg-wg-green/15 text-wg-green-dark",
      href: "/vagas/gerenciar?view=kanban",
    },
    {
      label: "Rascunhos",
      value: draftJobs,
      icon: FileText as ElementType,
      iconClass: "bg-blue-100 text-blue-600",
      href: "/vagas/gerenciar?status=DRAFT",
    },
    {
      label: "Vagas Pausadas",
      value: pausedJobs,
      icon: PauseCircle as ElementType,
      iconClass: "bg-yellow-100 text-yellow-600",
      href: "/vagas/gerenciar?status=PAUSED",
    },
    {
      label: "Vagas Canceladas",
      value: closedJobs,
      icon: XCircle as ElementType,
      iconClass: "bg-gray-200 text-gray-600",
      href: "/vagas/gerenciar?status=CLOSED",
    },
    {
      label: "Vagas Finalizadas",
      value: filledJobs,
      icon: CheckCircle2 as ElementType,
      iconClass: "bg-emerald-100 text-emerald-600",
      href: "/vagas/gerenciar?status=FILLED",
    },
  ];

  const monthDiff = thisMonthCount - lastMonthCount;
  const monthTrend =
    monthDiff > 0 ? `+${monthDiff} vs mês anterior` :
    monthDiff < 0 ? `${monthDiff} vs mês anterior` :
    "igual ao mês anterior";

  type Alert = { icon: ElementType; color: string; bg: string; message: string; href: string };
  const alerts: Alert[] = [
    expiringSoon > 0 && {
      icon: Clock as ElementType,
      color: "text-yellow-700",
      bg: "bg-yellow-50 border-yellow-200",
      message: `${expiringSoon} vaga${expiringSoon > 1 ? "s encerram" : " encerra"} nos próximos 7 dias`,
      href: "/vagas/gerenciar?status=ACTIVE",
    },
    openedLong > 0 && {
      icon: Calendar as ElementType,
      color: "text-orange-700",
      bg: "bg-orange-50 border-orange-200",
      message: `${openedLong} vaga${openedLong > 1 ? "s abertas" : " aberta"} há mais de 30 dias — verificar andamento`,
      href: "/vagas/gerenciar?status=ACTIVE",
    },
  ].filter(Boolean) as Alert[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {session?.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Painel de Gente &amp; Gestão — WG Baterias</p>
      </div>

      {/* Alertas proativos */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2 mb-6">
          {alerts.map((alert, i) => (
            <Link
              key={i}
              href={alert.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-opacity hover:opacity-80 ${alert.bg}`}
            >
              <alert.icon className={`w-4 h-4 shrink-0 ${alert.color}`} />
              <span className={alert.color}>{alert.message}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.iconClass}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
            <Link href={stat.href} className="text-xs text-wg-green-dark hover:opacity-80 underline mt-1 block transition-opacity">
              Ver detalhes →
            </Link>
          </div>
        ))}
      </div>

      {/* Tendência mensal */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Vagas publicadas este mês</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{thisMonthCount}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-medium ${monthDiff > 0 ? "text-wg-green-dark" : monthDiff < 0 ? "text-red-600" : "text-gray-500"}`}>
            {monthTrend}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{lastMonthCount} no mês anterior</p>
        </div>
      </div>

      {/* Candidaturas */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-wg-green-dark" />
            <h2 className="font-semibold text-gray-900">Candidaturas</h2>
            <span className="text-xs text-gray-500">
              {totalApplications} no total
              {newApplications > 0 && (
                <span className="ml-2 text-blue-600">· {newApplications} nova{newApplications > 1 ? "s" : ""}</span>
              )}
            </span>
          </div>
        </div>

        {recentApplications.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhuma candidatura recebida ainda"
            description="As inscrições feitas pelo portal aparecem aqui."
            className="py-10"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {recentApplications.map((app) => (
              <Link
                key={app.id}
                href={`/vagas/${app.jobId}/candidatos`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors gap-3"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-900">{app.fullName}</span>
                  <span className="text-xs text-gray-500 ml-2">{app.job?.title}</span>
                </div>
                {app.stage && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: `${app.stage.color}1f`, color: app.stage.color }}
                  >
                    {app.stage.name}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Admissões */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-wg-green-dark" />
            <h2 className="font-semibold text-gray-900">Admissões</h2>
            <span className="text-xs text-gray-500">{admissionsTotal} no total</span>
          </div>
          <Link href="/admissoes" className="text-sm text-wg-green-dark hover:opacity-80 transition-opacity">
            Ver todas
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 border-b border-gray-100">
          <MiniStat label="Em andamento" value={admissionsInProgress} icon={Users} iconClass="bg-blue-100 text-blue-600" />
          <MiniStat label="Concluídas" value={admissionsDone} icon={CheckCircle2} iconClass="bg-wg-green/15 text-wg-green-dark" />
          <MiniStat label="Atrasadas" value={admissionsLate} icon={AlertTriangle} iconClass="bg-red-100 text-red-600" />
          <MiniStat label="Próximas 7 dias" value={admissionsUpcoming} icon={CalendarClock} iconClass="bg-amber-100 text-amber-600" />
        </div>

        {recentAdmissions.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="Nenhuma admissão em andamento"
            description="As admissões cadastradas aparecem aqui."
            className="py-10"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {recentAdmissions.map((adm) => (
              <Link
                key={adm.id}
                href={`/admissoes/${adm.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors gap-3"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-900">{adm.fullName}</span>
                  {adm.position?.name && (
                    <span className="text-xs text-gray-500 ml-2">{adm.position.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {adm.startDate && (
                    <span className="text-xs text-gray-500">
                      {new Date(adm.startDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </span>
                  )}
                  {adm.stage && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${adm.stage.color}1f`, color: adm.stage.color }}
                    >
                      {adm.stage.name}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Vagas recentes */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Vagas Recentes</h2>
          <Link href="/vagas/gerenciar" className="text-sm text-wg-green-dark hover:opacity-80 transition-opacity">
            Ver todas
          </Link>
        </div>

        {recentJobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Nenhuma vaga cadastrada ainda"
            description="Crie sua primeira vaga para começar."
            className="py-10"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/vagas/${job.id}/editar`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">{job.title}</span>
                  <span className="text-xs text-gray-500 ml-2">{job.city}/{job.state}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[job.status]}`}>
                  {statusLabel[job.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Atalhos rápidos */}
      {session?.user.role === "ADMIN_RH" && (
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/vagas/nova"
            className="bg-wg-green hover:bg-wg-green-bright text-black rounded-xl p-4 flex items-center gap-3 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Nova Vaga
          </Link>
          <Link
            href="/vagas/gerenciar"
            className="bg-white hover:bg-gray-50 border border-gray-200 shadow-sm rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <Briefcase className="w-5 h-5 text-wg-green-dark" />
            <span className="font-medium text-gray-900">Gerenciar Vagas</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number;
  icon: ElementType;
  iconClass: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-xs text-gray-500 truncate">{label}</div>
      </div>
    </div>
  );
}
