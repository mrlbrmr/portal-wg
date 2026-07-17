import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { KanbanColumnDef } from "@/components/internal/KanbanBoardShell";
import {
  AdmissionKanbanBoard,
  NO_STAGE,
  type KanbanAdmission,
} from "@/components/internal/admissao/AdmissionKanbanBoard";

export const metadata: Metadata = { title: "Kanban de Admissões — RH" };

export default async function AdmissoesKanbanPage() {
  const [session, stages, admissions, users] = await Promise.all([
    auth(),
    prisma.admissionStage.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.admission.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        fullName: true,
        stageId: true,
        startDate: true,
        responsibleId: true,
        position: { select: { name: true } },
        company: { select: { name: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  const canManage = session?.user.role === "ADMIN_RH";
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const cards: KanbanAdmission[] = admissions.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    stageKey: a.stageId ?? NO_STAGE,
    positionName: a.position?.name ?? null,
    companyName: a.company?.name ?? null,
    branchName: a.branch?.name ?? null,
    responsibleName: a.responsibleId ? userMap.get(a.responsibleId) ?? null : null,
    startDate: a.startDate ? a.startDate.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null,
  }));

  const hasUnstaged = cards.some((c) => c.stageKey === NO_STAGE);
  const columns: KanbanColumnDef[] = [
    ...(hasUnstaged ? [{ key: NO_STAGE, label: "Sem etapa", dotColor: "#cbd5e1" }] : []),
    ...stages.map((s) => ({ key: s.id, label: s.name, dotColor: s.color })),
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kanban de Admissões</h1>
          <p className="text-gray-500 text-sm mt-1">
            Acompanhe as admissões por etapa. {canManage ? "Arraste os cards para mover." : ""}
          </p>
        </div>
        {canManage && (
          <Link
            href="/admissoes/nova"
            className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-semibold px-4 py-2.5 rounded-full text-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nova admissão
          </Link>
        )}
      </div>

      <AdmissionKanbanBoard admissions={cards} columns={columns} canManage={canManage} />
    </div>
  );
}
