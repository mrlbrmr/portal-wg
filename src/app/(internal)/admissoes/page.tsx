import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { loadAdmissionRows, admissionFlags } from "@/lib/admissao/overview";
import { PageHeader } from "@/components/internal/PageHeader";
import { PrimaryActionLink } from "@/components/internal/PrimaryActionLink";
import { CompactMetrics } from "@/components/ui/CompactMetrics";
import { AdmissionsExplorer } from "@/components/internal/admissao/AdmissionsExplorer";

export const metadata: Metadata = { title: "Admissões — RH" };

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

  // A lista recebe todas; concluídas (etapa final) ficam ocultas até filtrar pela etapa.
  const openRows = admissions.filter((a) => !a.isFinal);
  const flags = openRows.map((a) => admissionFlags(a, now));
  const doneCount = admissions.length - openRows.length;
  const finalStageIds = config.stages.filter((s) => s.isFinal).map((s) => s.id);

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
          {
            label: "concluídas",
            value: doneCount,
            hint: "Admissões na etapa de conclusão — ocultas da lista por padrão",
            href: finalStageIds.length > 0 ? `/admissoes?etapa=${finalStageIds.join(",")}` : undefined,
          },
        ]}
      />

      <AdmissionsExplorer
        // Remonta quando a URL muda por navegação (ex.: clique numa métrica acima).
        key={new URLSearchParams(params as Record<string, string>).toString()}
        rows={admissions}
        stages={config.stages}
        companies={config.companies}
        positions={config.positions}
        canManage={canWrite}
        initialParams={params}
      />
    </div>
  );
}
