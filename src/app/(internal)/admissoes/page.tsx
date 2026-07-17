import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import {
  AdmissionsExplorer,
  type AdmissionRow,
} from "@/components/internal/admissao/AdmissionsExplorer";

export const metadata: Metadata = { title: "Admissões — RH" };

// Lista de admissões ativas (soft-delete filtrado). Busca/filtros são
// client-side no AdmissionsExplorer; aqui carregamos os dados e a config.
export default async function AdmissoesPage() {
  const [session, config, admissions] = await Promise.all([
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
  ]);

  const canWrite = session?.user.role === "ADMIN_RH";
  const userMap = new Map(config.users.map((u) => [u.id, u.name]));

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

      <AdmissionsExplorer
        rows={rows}
        stages={config.stages}
        companies={config.companies}
        positions={config.positions}
      />
    </div>
  );
}
