import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Briefcase, PauseCircle, XCircle, Plus, FileText, AlertTriangle, Clock, Calendar } from "lucide-react";
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
  ] = await Promise.all([
    prisma.job.count({ where: { status: "ACTIVE" } }),
    prisma.job.count({ where: { status: "PAUSED" } }),
    prisma.job.count({ where: { status: "CLOSED" } }),
    prisma.job.count({ where: { status: "DRAFT" } }),
    prisma.job.count({ where: { status: "ACTIVE", tallyFormUrl: null } }),
    prisma.job.count({
      where: { status: "ACTIVE", closingDate: { gte: now, lte: sevenDaysFromNow } },
    }),
    prisma.job.count({ where: { status: "ACTIVE", createdAt: { lte: thirtyDaysAgo } } }),
    prisma.job.count({ where: { createdAt: { gte: startOfThisMonth, lt: startOfNextMonth } } }),
    prisma.job.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } } }),
  ]);

  const recentJobs = await prisma.job.findMany({
    take: 6,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, city: true, state: true, createdAt: true },
  });

  const statusBadge: Record<string, string> = {
    DRAFT: "bg-blue-500/10 text-blue-400",
    ACTIVE: "bg-wg-green/10 text-wg-green",
    PAUSED: "bg-yellow-500/10 text-yellow-400",
    CLOSED: "bg-wg-border text-wg-gray",
  };
  const statusLabel: Record<string, string> = {
    DRAFT: "Rascunho",
    ACTIVE: "Ativa",
    PAUSED: "Pausada",
    CLOSED: "Encerrada",
  };

  const stats = [
    {
      label: "Vagas Ativas",
      value: activeJobs,
      icon: Briefcase as ElementType,
      iconClass: "bg-wg-green/10 text-wg-green",
      href: "/vagas/gerenciar?status=ACTIVE",
    },
    {
      label: "Rascunhos",
      value: draftJobs,
      icon: FileText as ElementType,
      iconClass: "bg-blue-500/10 text-blue-400",
      href: "/vagas/gerenciar?status=DRAFT",
    },
    {
      label: "Vagas Pausadas",
      value: pausedJobs,
      icon: PauseCircle as ElementType,
      iconClass: "bg-yellow-500/10 text-yellow-400",
      href: "/vagas/gerenciar?status=PAUSED",
    },
    {
      label: "Vagas Encerradas",
      value: closedJobs,
      icon: XCircle as ElementType,
      iconClass: "bg-wg-border text-wg-gray",
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
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/20",
      message: `${activeWithoutTally} vaga${activeWithoutTally > 1 ? "s ativas sem" : " ativa sem"} link do Tally — candidatos não conseguem se inscrever`,
      href: "/vagas/gerenciar?status=ACTIVE",
    },
    expiringSoon > 0 && {
      icon: Clock as ElementType,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10 border-yellow-500/20",
      message: `${expiringSoon} vaga${expiringSoon > 1 ? "s encerram" : " encerra"} nos próximos 7 dias`,
      href: "/vagas/gerenciar?status=ACTIVE",
    },
    openedLong > 0 && {
      icon: Calendar as ElementType,
      color: "text-orange-400",
      bg: "bg-orange-500/10 border-orange-500/20",
      message: `${openedLong} vaga${openedLong > 1 ? "s abertas" : " aberta"} há mais de 30 dias — verificar andamento`,
      href: "/vagas/gerenciar?status=ACTIVE",
    },
  ].filter(Boolean) as Alert[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Olá, {session?.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-wg-gray text-sm mt-1">Painel de Gente &amp; Gestão — WG Baterias</p>
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
          <div key={stat.label} className="bg-wg-card border border-wg-border rounded-xl p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.iconClass}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-wg-gray mt-0.5">{stat.label}</div>
            <Link href={stat.href} className="text-xs text-wg-green hover:text-wg-green-bright underline mt-1 block transition-colors">
              Ver detalhes →
            </Link>
          </div>
        ))}
      </div>

      {/* Tendência mensal */}
      <div className="bg-wg-card border border-wg-border rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-wg-gray">Vagas publicadas este mês</p>
          <p className="text-2xl font-bold text-white mt-0.5">{thisMonthCount}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-medium ${monthDiff > 0 ? "text-wg-green" : monthDiff < 0 ? "text-red-400" : "text-wg-gray"}`}>
            {monthTrend}
          </p>
          <p className="text-xs text-wg-gray mt-0.5">{lastMonthCount} no mês anterior</p>
        </div>
      </div>

      {/* Vagas recentes */}
      <div className="bg-wg-card border border-wg-border rounded-xl mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-wg-border">
          <h2 className="font-semibold text-white">Vagas Recentes</h2>
          <Link href="/vagas/gerenciar" className="text-sm text-wg-green hover:text-wg-green-bright transition-colors">
            Ver todas
          </Link>
        </div>

        {recentJobs.length === 0 ? (
          <div className="px-5 py-10 text-center text-wg-gray text-sm">
            Nenhuma vaga cadastrada ainda.
          </div>
        ) : (
          <div className="divide-y divide-wg-border">
            {recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/vagas/${job.id}/editar`}
                className="flex items-center justify-between px-5 py-3 hover:bg-wg-card-2 transition-colors"
              >
                <div>
                  <span className="text-sm font-medium text-white">{job.title}</span>
                  <span className="text-xs text-wg-gray ml-2">{job.city}/{job.state}</span>
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
            className="bg-wg-card hover:bg-wg-card-2 border border-wg-border rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <Briefcase className="w-5 h-5 text-wg-green" />
            <span className="font-medium text-white">Gerenciar Vagas</span>
          </Link>
        </div>
      )}
    </div>
  );
}
