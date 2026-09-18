import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import JobForm from "@/components/internal/JobForm";
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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Nova vaga</h1>
      <p className="text-sm text-gray-500 mb-6">
        Para abrir uma vaga a partir de um pedido de gestor, use o módulo de{" "}
        <Link href="/solicitacoes" className="text-wg-green-dark font-semibold underline">
          Solicitações
        </Link>{" "}
        — assim a contratação passa pela validação do RH e pela aprovação antes de virar
        processo seletivo.
      </p>
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
        <JobForm currentUserName={session.user.name} />
      </div>
    </div>
  );
}
