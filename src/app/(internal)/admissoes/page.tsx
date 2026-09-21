import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { loadAdmissionRows, admissionFlags } from "@/lib/admissao/overview";
import { PageHeader } from "@/components/internal/PageHeader";
import { PrimaryActionLink } from "@/components/internal/PrimaryActionLink";
import { CompactMetrics } from "@/components/ui/CompactMetrics";
import { AdmissionDashboardClient } from "@/components/internal/admissao/AdmissionDashboardClient";
import {
  NO_STAGE,
  type KanbanAdmission,
} from "@/components/internal/admissao/AdmissionKanbanBoard";
import type { KanbanColumnDef } from "@/components/internal/KanbanBoardShell";

export const metadata: Metadata = { title: "Admissões — RH" };

function fmtDateBR(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function AdmissoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const [session, config, params] = await Promise.all([auth(), getAdmissionConfig(), searchParams]);
  const admissions = await loadAdmissionRows(supabase, config);

  const canWrite = session?.user.role === "ADMIN_RH";
  const now = new Date();

  // Lista: apenas admissões em aberto. Kanban: todas (inclusive concluídas).
  const openRows = admissions.filter((a) => !a.isFinal);
  const flags = openRows.map((a) => admissionFlags(a, now));
  const doneCount = admissions.length - openRows.length;

  const kanbanCards: KanbanAdmission[] = admissions.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    stageKey: a.stageId ?? NO_STAGE,
    positionName: a.positionName,
    companyName: a.companyName,
    branchName: a.branchName,
    responsibleName: a.responsibleName,
    startDate: fmtDateBR(a.startDateISO),
  }));

  const hasUnstaged = kanbanCards.some((c) => c.stageKey === NO_STAGE);
  const columns: KanbanColumnDef[] = [
    ...(hasUnstaged ? [{ key: NO_STAGE, label: "Sem etapa", dotColor: "#94a3b8" }] : []),
    ...config.stages.map((s) => ({ key: s.id, label: s.name, dotColor: s.color })),
  ];

  return (
    <div>
      <PageHeader
        title="Admissões"
        subtitle="Onboarding dos novos colaboradores do Grupo WG — progresso, documentos e prazos de início."
        action={
          canWrite ? (
            <PrimaryActionLink href="/admissoes/nova" icon={Plus}>
              Nova admissão
            </PrimaryActionLink>
          ) : undefined
        }
      />

      <CompactMetrics
        className="mb-4"
        total={{ value: openRows.length, label: "em andamento" }}
        items={[
          { label: "com início vencido", value: flags.filter((f) => f.late).length, tone: "danger", href: "/admissoes?filtro=atrasadas" },
          { label: "começam em 7 dias", value: flags.filter((f) => f.upcoming).length, tone: "info", href: "/admissoes?filtro=proximas" },
          { label: "com documentos pendentes", value: flags.filter((f) => f.missingDocs).length, tone: "warning", href: "/admissoes?filtro=documentos" },
          { label: "aguardando formulário", value: flags.filter((f) => f.waitingForm).length, tone: "neutral", href: "/admissoes?filtro=formulario" },
          { label: "concluídas", value: doneCount, hint: "Admissões em etapa final — visíveis no Kanban e nos relatórios" },
        ]}
      />

      <AdmissionDashboardClient
        key={new URLSearchParams(params as Record<string, string>).toString()}
        rows={openRows}
        kanbanCards={kanbanCards}
        columns={columns}
        stages={config.stages}
        companies={config.companies}
        positions={config.positions}
        canManage={canWrite}
        initialParams={params}
      />
    </div>
  );
}
