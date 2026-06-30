import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Briefcase, PauseCircle, XCircle, Plus } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard — RH" };

export default async function DashboardPage() {
  const session = await auth();

  const [activeJobs, pausedJobs, closedJobs] = await Promise.all([
    prisma.job.count({ where: { status: "ACTIVE" } }),
    prisma.job.count({ where: { status: "PAUSED" } }),
    prisma.job.count({ where: { status: "CLOSED" } }),
  ]);

  const recentJobs = await prisma.job.findMany({
    take: 6,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, city: true, state: true, createdAt: true },
  });

  const statusBadge: Record<string, string> = {
    ACTIVE: "bg-wg-green/10 text-wg-green",
    PAUSED: "bg-yellow-500/10 text-yellow-400",
    CLOSED: "bg-wg-border text-wg-gray",
  };
  const statusLabel: Record<string, string> = {
    ACTIVE: "Ativa",
    PAUSED: "Pausada",
    CLOSED: "Encerrada",
  };

  const stats = [
    {
      label: "Vagas Ativas",
      value: activeJobs,
      icon: Briefcase,
      iconClass: "bg-wg-green/10 text-wg-green",
      href: "/vagas/gerenciar?status=ACTIVE",
    },
    {
      label: "Vagas Pausadas",
      value: pausedJobs,
      icon: PauseCircle,
      iconClass: "bg-yellow-500/10 text-yellow-400",
      href: "/vagas/gerenciar?status=PAUSED",
    },
    {
      label: "Vagas Encerradas",
      value: closedJobs,
      icon: XCircle,
      iconClass: "bg-wg-border text-wg-gray",
      href: "/vagas/gerenciar?status=CLOSED",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Olá, {session?.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-wg-gray text-sm mt-1">Painel de Gente &amp; Gestão — WG Baterias</p>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-3 gap-4 mb-8">
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
