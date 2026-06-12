import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Briefcase, Users, Clock, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard — RH" };

export default async function DashboardPage() {
  const session = await auth();

  const [activeJobs, totalApplications, recentApplications, byStatus] = await Promise.all([
    prisma.job.count({ where: { status: "ACTIVE" } }),
    prisma.application.count(),
    prisma.application.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        candidate: { select: { fullName: true } },
        job: { select: { title: true } },
      },
    }),
    prisma.application.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const received = byStatus.find((s) => s.status === "RECEIVED")?._count.status || 0;
  const inReview = byStatus.find((s) => s.status === "HR_REVIEW")?._count.status || 0;

  const stats = [
    { label: "Vagas Ativas", value: activeJobs, icon: Briefcase, color: "bg-orange-100 text-orange-600", href: "/vagas/gerenciar" },
    { label: "Total de Candidaturas", value: totalApplications, icon: Users, color: "bg-blue-100 text-blue-600", href: null },
    { label: "Aguardando Análise", value: received, icon: Clock, color: "bg-yellow-100 text-yellow-600", href: null },
    { label: "Em Análise RH", value: inReview, icon: TrendingUp, color: "bg-purple-100 text-purple-600", href: null },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {session?.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Painel de Gente &amp; Gestão — WG Baterias</p>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
            {stat.href && (
              <Link href={stat.href} className="text-xs text-orange-600 hover:underline mt-1 block">
                Ver detalhes →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Candidaturas recentes */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Candidaturas Recentes</h2>
          <Link href="/candidatos" className="text-sm text-orange-600 hover:underline">
            Ver todas
          </Link>
        </div>

        {recentApplications.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            Nenhuma candidatura ainda.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentApplications.map((app) => (
              <Link
                key={app.id}
                href={`/candidatos/${app.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {app.candidate.fullName}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">→ {app.job.title}</span>
                </div>
                <StatusBadge status={app.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Atalhos rápidos */}
      {session?.user.role === "ADMIN_RH" && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Link
            href="/vagas/nova"
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <Briefcase className="w-5 h-5" />
            <span className="font-medium">Nova Vaga</span>
          </Link>
          <Link
            href="/vagas/gerenciar"
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-gray-700">Gerenciar Vagas</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    RECEIVED: "bg-blue-100 text-blue-700",
    HR_REVIEW: "bg-yellow-100 text-yellow-700",
    SELECTED_INTERVIEW: "bg-purple-100 text-purple-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    TALENT_POOL: "bg-teal-100 text-teal-700",
  };
  const labels: Record<string, string> = {
    RECEIVED: "Recebido",
    HR_REVIEW: "Em análise",
    SELECTED_INTERVIEW: "Selecionado",
    INTERVIEW_SCHEDULED: "Agendado",
    INTERVIEWED: "Entrevistado",
    SENT_TO_MANAGER: "Enviado ao gestor",
    APPROVED: "Aprovado",
    REJECTED: "Reprovado",
    NO_SHOW: "Não compareceu",
    TALENT_POOL: "Banco de talentos",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {labels[status] || status}
    </span>
  );
}
