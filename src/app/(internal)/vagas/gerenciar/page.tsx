import { createClient } from "@/lib/supabase/server";
import { auth } from "@/lib/auth";
import { Plus } from "lucide-react";
import { ExportCsvButton } from "@/components/internal/ExportCsvButton";
import { JobsExplorer } from "@/components/internal/JobsExplorer";
import { PageHeader } from "@/components/internal/PageHeader";
import { PrimaryActionLink } from "@/components/internal/PrimaryActionLink";
import { CompactMetrics } from "@/components/ui/CompactMetrics";
import { loadJobRows } from "@/lib/recruitment/job-rows";
import { jobLifecycle } from "@/lib/recruitment/job-presentation";
import { jobAttentionReasons } from "@/lib/recruitment/attention";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vagas — RH" };

export default async function GerenciarVagasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [session, params, supabase] = await Promise.all([auth(), searchParams, createClient()]);
  const canManage = session?.user.role === "ADMIN_RH";
  const rows = await loadJobRows(supabase);

  // Métricas compactas: a lista é a tarefa principal da página, não os números.
  const byLifecycle = (l: string) => rows.filter((j) => jobLifecycle(j.status) === l).length;
  const now = new Date();
  const needAttention = rows.filter((j) => jobAttentionReasons(j, now).length > 0).length;

  return (
    <div>
      <PageHeader
        title="Vagas"
        subtitle="Processos seletivos em andamento — status, etapa, idade e pendências de cada vaga."
        action={
          <>
            <ExportCsvButton status={params.status} />
            {canManage && (
              <PrimaryActionLink href="/vagas/nova" icon={Plus}>
                Nova vaga
              </PrimaryActionLink>
            )}
          </>
        }
      />

      <CompactMetrics
        className="mb-4"
        total={{ value: rows.length, label: rows.length === 1 ? "vaga" : "vagas" }}
        items={[
          { label: "abertas", value: byLifecycle("OPEN"), tone: "success", href: "/vagas/gerenciar?status=OPEN" },
          { label: "precisam de atenção", value: needAttention, tone: "warning", href: "/vagas/gerenciar?pendencia=atencao" },
          { label: "rascunhos", value: byLifecycle("DRAFT"), tone: "neutral", href: "/vagas/gerenciar?status=DRAFT" },
          { label: "pausadas", value: byLifecycle("PAUSED"), href: "/vagas/gerenciar?status=PAUSED" },
          { label: "encerradas", value: byLifecycle("FILLED"), href: "/vagas/gerenciar?status=FILLED" },
          { label: "canceladas", value: byLifecycle("CLOSED"), href: "/vagas/gerenciar?status=CLOSED" },
        ]}
      />

      <JobsExplorer
        // Remonta quando a URL muda por navegação (ex.: clique numa métrica acima).
        key={new URLSearchParams(params as Record<string, string>).toString()}
        jobs={rows}
        canManage={canManage}
        initialParams={params}
        currentUserName={(session?.user as { name?: string | null } | undefined)?.name ?? null}
      />
    </div>
  );
}
