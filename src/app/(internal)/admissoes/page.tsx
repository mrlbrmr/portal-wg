import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users, CheckCircle2, AlertTriangle, CalendarClock } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
         stage:admission_stages(id, name, color, isFinal)`
      )
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .limit(300),
    // Métricas sobre TODAS as ativas (não só as 300 carregadas): computadas em JS.
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
    (m) => m.startDate && new Date(m.startDate) >= todayUTC && new Date(m.startDate) <= in7 && !m.stage?.isFinal
  ).length;

  const canWrite = session?.user.role === "ADMIN_RH";
  const userMap = new Map(config.users.map((u) => [u.id, u.name]));
  const inProgress = total - doneCount;

  // Lista: apenas admissões em aberto (fora de etapas finais).
  // Admissões concluídas aparecem no Kanban e no Histórico, não aqui.
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
    responsibleName: a.responsibleId ? userMap.get(a.responsibleId) ?? null : null,
    startDate: a.startDate
      ? new Date(a.startDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : null,
    startDateISO: a.startDate ? new Date(a.startDate).toISOString().slice(0, 10) : null,
    createdAt: new Date(a.createdAt).toISOString(),
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
