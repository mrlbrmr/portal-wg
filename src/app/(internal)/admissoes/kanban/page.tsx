import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/internal/PageHeader";
import { PrimaryActionLink } from "@/components/internal/PrimaryActionLink";
import type { KanbanColumnDef } from "@/components/internal/KanbanBoardShell";
import {
  AdmissionKanbanBoard,
  NO_STAGE,
  type KanbanAdmission,
} from "@/components/internal/admissao/AdmissionKanbanBoard";

export const metadata: Metadata = { title: "Kanban de Admissões — RH" };

export default async function AdmissoesKanbanPage() {
  const supabase = await createClient();
  const [session, stagesRes, admissionsRes, usersRes] = await Promise.all([
    auth(),
    supabase
      .from("admission_stages")
      .select("id, name, color")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
    supabase
      .from("admissions")
      .select(
        `id, fullName, stageId, startDate, responsibleId,
         position:admission_positions(name),
         company:admission_companies(name),
         branch:admission_branches(name)`
      )
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .limit(500),
    supabase.from("users").select("id, name").eq("active", true),
  ]);

  const stages = (stagesRes.data ?? []) as Array<{ id: string; name: string; color: string }>;
  const admissions = (admissionsRes.data ?? []) as unknown as Array<{
    id: string;
    fullName: string;
    stageId: string | null;
    startDate: string | null;
    responsibleId: string | null;
    position: { name: string } | null;
    company: { name: string } | null;
    branch: { name: string } | null;
  }>;
  const users = (usersRes.data ?? []) as Array<{ id: string; name: string }>;

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
    startDate: a.startDate
      ? new Date(a.startDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : null,
  }));

  const hasUnstaged = cards.some((c) => c.stageKey === NO_STAGE);
  const columns: KanbanColumnDef[] = [
    ...(hasUnstaged ? [{ key: NO_STAGE, label: "Sem etapa", dotColor: "#94a3b8" }] : []),
    ...stages.map((s) => ({ key: s.id, label: s.name, dotColor: s.color })),
  ];

  return (
    <div>
      <PageHeader
        title="Kanban de Admissões"
        subtitle={`Acompanhe as admissões por etapa.${canManage ? " Arraste os cards para mover." : ""}`}
        action={
          canManage ? (
            <PrimaryActionLink href="/admissoes/nova" icon={Plus}>
              Nova admissão
            </PrimaryActionLink>
          ) : undefined
        }
      />

      <AdmissionKanbanBoard admissions={cards} columns={columns} canManage={canManage} />
    </div>
  );
}
