import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadOrgUnits } from "@/lib/registries/org-units-data";
import { redirect } from "next/navigation";
import Link from "next/link";
import JobForm from "@/components/internal/JobForm";
import { loadJobTemplates } from "@/lib/jobs/template-data";
import { loadProcessTemplates } from "@/lib/selection-funnel/process-data";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nova Vaga — RH" };

/**
 * Criação avulsa de vaga (sem solicitação de origem) — usada para bancos de talentos e
 * casos em que a autorização veio por fora do sistema.
 *
 * A vaga originada de uma solicitação NÃO nasce aqui: ela é criada pela ação
 * "Criar processo seletivo" na tela da solicitação, que roda em uma transação no banco e
 * já devolve a vaga em Rascunho pronta para ser completada em /vagas/[id]/editar.
 */
export default async function NovaVagaPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  return (
    <div className="max-w-3xl">
      <h1 className="font-sora text-2xl font-semibold tracking-tight text-wg-ink md:text-page-title">Nova vaga</h1>
      <p className="mb-6 mt-1 text-meta text-wg-ink-muted">
        Para abrir uma vaga a partir de um pedido de gestor, use o módulo de{" "}
        <Link href="/solicitacoes" className="font-semibold text-wg-green-dark underline">
          Solicitações
        </Link>{" "}
        — assim a contratação passa pela validação do RH e pela aprovação antes de virar
        processo seletivo.
      </p>
      <JobForm
        currentUserName={session.user.name}
        orgUnits={await loadOrgUnits(await createClient())}
        templates={await loadJobTemplates()}
        processModels={(await loadProcessTemplates())
          .filter((t) => t.active)
          .map((t) => ({ id: t.id, name: t.name, isDefault: t.isDefault, stageIds: t.stageIds }))}
      />
    </div>
  );
}
