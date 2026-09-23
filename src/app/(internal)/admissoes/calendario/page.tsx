import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { PageHeader } from "@/components/internal/PageHeader";
import { PageContainer } from "@/components/ui/PageContainer";
import { AdmissionCalendar, type CalendarAdmission } from "@/components/internal/admissao/AdmissionCalendar";

export const metadata: Metadata = { title: "Calendário — RH" };

function day(d: string | null): string | null {
  return d ? d.slice(0, 10) : null;
}

export default async function AdmissoesCalendarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const [session, config, params, admissionsRes] = await Promise.all([
    auth(),
    getAdmissionConfig(),
    searchParams,
    supabase
      .from("admissions")
      .select(
        `id, fullName, startDate, medicalExamDate, birthDate, companyId, branchId, responsibleId,
         digitalFormToken, digitalFormExpiresAt, digitalFormSubmittedAt,
         position:admission_positions(name), company:admission_companies(name),
         branch:admission_branches(name), stage:admission_stages(name, color, isFinal)`
      )
      .is("deletedAt", null)
      .or("startDate.not.is.null,medicalExamDate.not.is.null,birthDate.not.is.null,digitalFormExpiresAt.not.is.null")
      .limit(2000),
  ]);

  const rows = (admissionsRes.data ?? []) as unknown as Array<{
    id: string;
    fullName: string;
    startDate: string | null;
    medicalExamDate: string | null;
    birthDate: string | null;
    companyId: string | null;
    branchId: string | null;
    responsibleId: string | null;
    digitalFormToken: string | null;
    digitalFormExpiresAt: string | null;
    digitalFormSubmittedAt: string | null;
    position: { name: string } | null;
    company: { name: string } | null;
    branch: { name: string } | null;
    stage: { name: string; color: string; isFinal: boolean } | null;
  }>;
  const userName = new Map(config.users.map((u) => [u.id, u.name]));

  // Nenhum dado sensível vai ao cliente: o token do link vira só um booleano.
  const admissions: CalendarAdmission[] = rows.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    startDate: day(a.startDate),
    examDate: day(a.medicalExamDate),
    birthDate: day(a.birthDate),
    positionName: a.position?.name ?? null,
    companyId: a.companyId,
    companyName: a.company?.name ?? null,
    branchId: a.branchId,
    branchName: a.branch?.name ?? null,
    responsibleId: a.responsibleId,
    responsibleName: a.responsibleId ? (userName.get(a.responsibleId) ?? null) : null,
    stageName: a.stage?.name ?? null,
    stageColor: a.stage?.color ?? null,
    isFinal: !!a.stage?.isFinal,
    digitalFormToken: !!a.digitalFormToken,
    digitalFormExpiresAt: a.digitalFormExpiresAt,
    digitalFormSubmittedAt: a.digitalFormSubmittedAt,
  }));

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  return (
    <PageContainer>
      <PageHeader
        className="mb-0"
        icon={CalendarDays}
        title="Calendário"
        subtitle="Inícios, exames médicos, experiências, aniversários e demais eventos relacionados às admissões."
      />
      {admissionsRes.error ? (
        <div role="alert" className="rounded-card border border-danger-border bg-danger-bg px-4 py-3 text-body text-danger-fg">
          Não foi possível carregar os eventos agora. Atualize a página em instantes.
        </div>
      ) : (
        <AdmissionCalendar
          admissions={admissions}
          companies={config.companies}
          branches={config.branches}
          users={config.users}
          canManage={session?.user.role === "ADMIN_RH"}
          today={today}
          initialParams={params}
        />
      )}
    </PageContainer>
  );
}
