import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/internal/PageHeader";
import { PrimaryActionLink } from "@/components/internal/PrimaryActionLink";
import { JobRequestsExplorer } from "@/components/internal/job-requests/JobRequestsExplorer";
import { listJobRequests } from "@/lib/job-requests/service";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Solicitações de Vaga — RH" };

/**
 * Módulo de Requisição de Vagas.
 *
 * Aqui ficam os PEDIDOS de contratação e seu fluxo de autorização. Vaga (processo
 * seletivo) é outra coisa e mora em /vagas — só aparece lá depois que a solicitação
 * correspondente for aprovada e o RH iniciar o recrutamento.
 */
export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [session, requests, params] = await Promise.all([auth(), listJobRequests(), searchParams]);
  const canCreate = session?.user.role === "ADMIN_RH";

  return (
    <div className="bg-slate-50">
      <PageHeader
        title="Solicitações de vaga"
        subtitle="Pedidos de contratação enviados pelos gestores. A vaga só é criada depois da aprovação."
        action={
          canCreate && (
            <PrimaryActionLink href="/solicitacoes/nova" icon={Plus}>
              Nova solicitação
            </PrimaryActionLink>
          )
        }
      />
      <JobRequestsExplorer requests={requests} initialStatus={params.status} />
    </div>
  );
}
