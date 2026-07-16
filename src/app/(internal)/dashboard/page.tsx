import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Briefcase, PauseCircle, XCircle, Plus, FileText, AlertTriangle, Clock, Calendar, Users } from "lucide-react";
import { PUBLIC_JOB_STATUS_LIST } from "@/lib/job-visibility";
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

  const [
    activeJobs,
    pausedJobs,
    closedJobs,
    draftJobs,
    activeWithoutTally,
    expiringSoon,
    openedLong,
    thisMonthCount,
    lastMonthCount,
    totalApplications,
    newApplications,
  ] = await Promise.all([
    prisma.job.count({ where: { status: "ACTIVE" } }),
    prisma.job.count({ where: { status: "PAUSED" } }),
    prisma.job.count({ where: { status: "CLOSED" } }),
    prisma.job.count({ where: { status: "DRAFT" } }),
    prisma.job.count({ where: { status: { in: PUBLIC_JOB_STATUS_LIST }, applyMode: "EXTERNAL", tallyFormUrl: null } }),
    prisma.job.count({
      where: { status: { in: PUBLIC_JOB_STATUS_LIST }, closingDate: { gte: now, lte: sevenDaysFromNow } },
    }),
    prisma.job.count({ where: { status: { in: PUBLIC_JOB_STATUS_LIST }, createdAt: { lte: thirtyDaysAgo } } }),
    prisma.job.count({ where: { createdAt: { gte: startOfThisMonth, lt: startOfNextMonth } } }),
    prisma.job.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } } }),
    prisma.application.count(),
    prisma.application.count({ where: { stage: "NEW" } }),
  ]);

  const recentJobs = await prisma.job.findMany({
    take: 6,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, city: true, state: true, createdAt: true },
  });

  const recentApplications = await prisma.application.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      stage: true,
      createdAt: true,
      jobId: true,
      job: { select: { title: true } },
    },
  });

  const statusBadge: Record<string, string> = {
    DRAFT: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-wg-green/15 text-wg-green-dark",
    SCREENING: "bg-amber-100 text-amber-700",
    INTERVIEW: "bg-purple-100 text-purple-700",
    ADMISSION: "bg-cyan-100 text-cyan-700",
    PAUSED: "bg-orange-100 text-orange-700",
    CLOSED: "bg-gray-200 text-gray-600",
  };
  const statusLabel: Record<string, string> = {
    DRAFT: "Rascunho",
    ACTIVE: "Ativa",
    SCREENING: "Triagem",
    INTERVIEW: "Entrevistas",
    ADMISSION: "Admissão",
    PAUSED: "Pausada",
    CLOSED: "Cancelada",
  };

  const stageLabel: Record<string, string> = {
    NEW: "Novo",
    SCREENING: "Triagem",
    INTERVIEW: "Entrevista",
    OFFER: "Proposta",
    HIRED: "Contratado",
    REJECTED: "Reprovado",
  };
  const stageBadge: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700",
    SCREENING: "bg-amber-100 text-amber-700",
    INTERVIEW: "bg-purple-100 text-purple-700",
    OFFER: "bg-cyan-100 text-cyan-700",
    HIRED: "bg-wg-green/15 text-wg-green-dark",
    REJECTED: "bg-red-100 text-red-700",
  };

  const stats = [
    {
      label: "Vagas Ativas",
      value: activeJobs,
      icon: Briefcase as ElementType,
      iconClass: "bg-wg-green/15 text-wg-green-dark",
      href: "/vagas/gerenciar?status=ACTIVE",
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
  ];

  const monthDiff = thisMonthCount - lastMonthCount;
  const monthTrend =
    monthDiff > 0 ? `+${monthDiff} vs mês anterior` :
    monthDiff < 0 ? `${monthDiff} vs mês anterior` :
    "igual ao mês anterior";

  type Alert = { icon: ElementType; color: string; bg: string; message: string; href: string };
  const alerts: Alert[] = [
    activeWithoutTally > 0 && {
      icon: AlertTriangle as ElementType,
      color: "text-red-700",
      bg: "bg-red-50 border-red-200",
      message: `${activeWithoutTally} vaga${activeWithoutTally > 1 ? "s ativas sem" : " ativa sem"} link do Tally — candidatos não conseguem se inscrever`,
      href: "/vagas/gerenciar?status=ACTIVE",
    },
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
          <div className="px-5 py-10 text-center text-gray-500 text-sm">
            Nenhuma candidatura recebida ainda.
          </div>
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
                  <span className="text-xs text-gray-500 ml-2">{app.job.title}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${stageBadge[app.stage]}`}>
                  {stageLabel[app.stage]}
                </span>
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
          <div className="px-5 py-10 text-center text-gray-500 text-sm">
            Nenhuma vaga cadastrada ainda.
          </div>
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
