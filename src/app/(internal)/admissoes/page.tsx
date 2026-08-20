import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { PageHeader } from "@/components/internal/PageHeader";
import { PrimaryActionLink } from "@/components/internal/PrimaryActionLink";
import { AdmissionDashboardClient } from "@/components/internal/admissao/AdmissionDashboardClient";
import type { AdmissionRow } from "@/components/internal/admissao/AdmissionsExplorer";
import {
  NO_STAGE,
  type KanbanAdmission,
} from "@/components/internal/admissao/AdmissionKanbanBoard";
import type { KanbanColumnDef } from "@/components/internal/KanbanBoardShell";

export const metadata: Metadata = { title: "Admissões — RH" };

export default async function AdmissoesPage() {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in7 = new Date(todayUTC.getTime() + 7 * 86400000);

  const supabase = await createClient();
  const [session, config, admissionsRes, metricsRes] = await Promise.all([
    auth(),
    getAdmissionConfig(),
    supabase
      .from("admissions")
      .select(
        `id, fullName, cpf, stageId, startDate, createdAt, companyId, responsibleId,
         position:admission_positions(name),
         company:admission_companies(name),
         branch:admission_branches(name),
         stage:admission_stages(id, name, color, isFinal)`
      )
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .limit(300),
    supabase
      .from("admissions")
      .select("startDate, stage:admission_stages(isFinal)")
      .is("deletedAt", null),
  ]);

  const admissions = (admissionsRes.data ?? []) as unknown as Array<{
    id: string;
    fullName: string;
    cpf: string | null;
    stageId: string | null;
    startDate: string | null;
    createdAt: string;
    companyId: string | null;
    responsibleId: string | null;
    position: { name: string } | null;
    company: { name: string } | null;
    branch: { name: string } | null;
    stage: { id: string; name: string; color: string; isFinal: boolean } | null;
  }>;

  const metricRows = (metricsRes.data ?? []) as unknown as Array<{
    startDate: string | null;
    stage: { isFinal: boolean } | null;
  }>;
  const total = metricRows.length;
  const doneCount = metricRows.filter((m) => m.stage?.isFinal).length;
  const lateCount = metricRows.filter(
    (m) => m.startDate && new Date(m.startDate) < todayUTC && !m.stage?.isFinal
  ).length;
  const upcomingCount = metricRows.filter(
    (m) =>
      m.startDate &&
      new Date(m.startDate) >= todayUTC &&
      new Date(m.startDate) <= in7 &&
      !m.stage?.isFinal
  ).length;

  const canWrite = session?.user.role === "ADMIN_RH";
  const userMap = new Map(config.users.map((u) => [u.id, u.name]));
  const inProgress = total - doneCount;

  // Lista: apenas admissões em aberto
  const openAdmissions = admissions.filter((a) => !a.stage?.isFinal);

  const rows: AdmissionRow[] = openAdmissions.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    cpf: a.cpf,
    positionName: a.position?.name ?? null,
    companyId: a.companyId ?? null,
    companyName: a.company?.name ?? null,
    branchName: a.branch?.name ?? null,
    stageId: a.stage?.id ?? null,
    stageName: a.stage?.name ?? null,
    stageColor: a.stage?.color ?? null,
    responsibleName: a.responsibleId ? (userMap.get(a.responsibleId) ?? null) : null,
    startDate: a.startDate
      ? new Date(a.startDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : null,
    startDateISO: a.startDate ? new Date(a.startDate).toISOString().slice(0, 10) : null,
    createdAt: new Date(a.createdAt).toISOString(),
  }));

  // Kanban: todas as admissões
  const kanbanCards: KanbanAdmission[] = admissions.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    stageKey: a.stageId ?? NO_STAGE,
    positionName: a.position?.name ?? null,
    companyName: a.company?.name ?? null,
    branchName: a.branch?.name ?? null,
    responsibleName: a.responsibleId ? (userMap.get(a.responsibleId) ?? null) : null,
    startDate: a.startDate
      ? new Date(a.startDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : null,
  }));

  const hasUnstaged = kanbanCards.some((c) => c.stageKey === NO_STAGE);
  const columns: KanbanColumnDef[] = [
    ...(hasUnstaged ? [{ key: NO_STAGE, label: "Sem etapa", dotColor: "#94a3b8" }] : []),
    ...config.stages.map((s) => ({ key: s.id, label: s.name, dotColor: s.color })),
  ];

  const kpiCards = [
    { emoji: "👤", iconBg: "#E9EDFA", value: inProgress,     label: "Em andamento" },
    { emoji: "✓",  iconBg: "#EAF4DC", value: doneCount,      label: "Concluídas" },
    { emoji: "⚠",  iconBg: "#FBE6E1", value: lateCount,      label: "Atrasadas · início já passou" },
    { emoji: "📅", iconBg: "#FCF1DD", value: upcomingCount,  label: "Próximos 7 dias" },
  ];

  return (
    <div>
      <PageHeader
        title="Admissões"
        subtitle="Controle de admissões ativas — onboarding dos novos colaboradores do Grupo WG."
        action={
          canWrite ? (
            <PrimaryActionLink href="/admissoes/nova" icon={Plus}>
              Nova admissão
            </PrimaryActionLink>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3 page-stagger">
        {kpiCards.map((k) => (
          <div
            key={k.label}
            className="bg-white border border-[#E7EEDD] rounded-2xl p-4 hover:shadow-[0_6px_16px_rgba(0,0,0,.06)] hover:-translate-y-0.5 transition-all cursor-default"
          >
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center text-[15px] mb-2.5"
              style={{ background: k.iconBg }}
            >
              {k.emoji}
            </div>
            <div className="text-[#1A2213] text-2xl font-extrabold font-sora tabular-nums">{k.value}</div>
            <div className="text-[#55614A] text-[12.5px] mt-0.5 font-inter">{k.label}</div>
          </div>
        ))}
      </div>

      <AdmissionDashboardClient
        rows={rows}
        kanbanCards={kanbanCards}
        columns={columns}
        stages={config.stages}
        companies={config.companies}
        positions={config.positions}
        canManage={canWrite}
      />
    </div>
  );
}
