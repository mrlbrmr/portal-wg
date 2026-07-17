import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users, CheckCircle2, AlertTriangle, CalendarClock } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { DashboardCard } from "@/components/internal/DashboardCard";
import {
  AdmissionsExplorer,
  type AdmissionRow,
} from "@/components/internal/admissao/AdmissionsExplorer";

export const metadata: Metadata = { title: "Admissões — RH" };

export default async function AdmissoesPage() {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in7 = new Date(todayUTC.getTime() + 7 * 86400000);

  const [session, config, admissions, total, doneCount, lateCount, upcomingCount] =
    await Promise.all([
      auth(),
      getAdmissionConfig(),
      prisma.admission.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 300,
        select: {
          id: true,
          fullName: true,
          cpf: true,
          startDate: true,
          responsibleId: true,
          position: { select: { name: true } },
          company: { select: { name: true } },
          branch: { select: { name: true } },
          stage: { select: { id: true, name: true, color: true } },
        },
      }),
      prisma.admission.count({ where: { deletedAt: null } }),
      prisma.admission.count({ where: { deletedAt: null, stage: { isFinal: true } } }),
      prisma.admission.count({
        where: {
          deletedAt: null,
          startDate: { lt: todayUTC },
          OR: [{ stage: null }, { stage: { isFinal: false } }],
        },
      }),
      prisma.admission.count({
        where: { deletedAt: null, startDate: { gte: todayUTC, lte: in7 } },
      }),
    ]);

  const canWrite = session?.user.role === "ADMIN_RH";
  const userMap = new Map(config.users.map((u) => [u.id, u.name]));
  const inProgress = total - doneCount;

  const rows: AdmissionRow[] = admissions.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    cpf: a.cpf,
    positionName: a.position?.name ?? null,
    companyName: a.company?.name ?? null,
    branchName: a.branch?.name ?? null,
    stageId: a.stage?.id ?? null,
    stageName: a.stage?.name ?? null,
    stageColor: a.stage?.color ?? null,
    responsibleName: a.responsibleId ? userMap.get(a.responsibleId) ?? null : null,
    startDate: a.startDate
      ? a.startDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : null,
  }));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admissões</h1>
          <p className="text-gray-500 text-sm mt-1">
            Controle de admissões ativas — onboarding dos novos colaboradores do Grupo WG.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/admissoes/nova"
            className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-semibold px-4 py-2.5 rounded-full text-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nova admissão
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <DashboardCard label="Em andamento" value={inProgress} icon={Users} />
        <DashboardCard
          label="Concluídas"
          value={doneCount}
          icon={CheckCircle2}
          iconClass="bg-wg-green/15 text-wg-green-dark"
        />
        <DashboardCard
          label="Atrasadas"
          value={lateCount}
          icon={AlertTriangle}
          iconClass="bg-red-100 text-red-600"
          hint="Início já passou"
        />
        <DashboardCard
          label="Próximas 7 dias"
          value={upcomingCount}
          icon={CalendarClock}
          iconClass="bg-amber-100 text-amber-600"
        />
      </div>

      <AdmissionsExplorer
        rows={rows}
        stages={config.stages}
        companies={config.companies}
        positions={config.positions}
      />
    </div>
  );
}
