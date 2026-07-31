import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { PageHeader } from "@/components/internal/PageHeader";
import { PrimaryActionLink } from "@/components/internal/PrimaryActionLink";
import {
  AdmissionsExplorer,
  type AdmissionRow,
} from "@/components/internal/admissao/AdmissionsExplorer";

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
        `id, fullName, cpf, startDate, createdAt, companyId, responsibleId,
         position:admission_positions(name),
         company:admission_companies(name),
         branch:admission_branches(name),
         stage:admission_stages(id, name, color, isFinal),
         checklistGroups:admission_checklist_groups(items:admission_checklist_items(id, status, parentId))`
      )
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .limit(300),
    supabase.from("admissions").select("startDate, stage:admission_stages(isFinal)").is("deletedAt", null),
  ]);

  const admissions = (admissionsRes.data ?? []) as unknown as Array<{
    id: string;
    fullName: string;
    cpf: string | null;
    startDate: string | null;
    createdAt: string;
    companyId: string | null;
    responsibleId: string | null;
    position: { name: string } | null;
    company: { name: string } | null;
    branch: { name: string } | null;
    stage: { id: string; name: string; color: string; isFinal: boolean } | null;
    checklistGroups: Array<{
      items: Array<{ id: string; status: string; parentId: string | null }>;
    }> | null;
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

  const openAdmissions = admissions.filter((a) => !a.stage?.isFinal);

  const rows: AdmissionRow[] = openAdmissions.map((a) => {
    const allItems = (a.checklistGroups ?? [])
      .flatMap((g) => g.items ?? [])
      .filter((i) => !i.parentId);
    const checklistDone = allItems.filter((i) => i.status === "DONE").length;
    const checklistTotal = allItems.length;

    return {
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
      checklistDone,
      checklistTotal,
    };
  });

  const kpiCards = [
    { emoji: "👤", iconBg: "#E9EDFA", value: inProgress, label: "Em andamento" },
    { emoji: "✓",  iconBg: "#EAF4DC", value: doneCount,   label: "Concluídas" },
    { emoji: "⚠",  iconBg: "#FBE6E1", value: lateCount,   label: "Atrasadas · início já passou" },
    { emoji: "📅", iconBg: "#FCF1DD", value: upcomingCount, label: "Próximos 7 dias" },
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

      <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
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

      <AdmissionsExplorer
        rows={rows}
        stages={config.stages}
        companies={config.companies}
        positions={config.positions}
      />
    </div>
  );
}
