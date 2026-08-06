import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Megaphone, ListChecks, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CONFIG } from "@/lib/homepage-config";
import HomepageConfigForm from "@/components/internal/HomepageConfigForm";
import { PageHeader } from "@/components/internal/PageHeader";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Configurações — RH" };

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const { data: config } = await supabase
    .from("homepage_config")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();

  return (
    <div>
      <PageHeader
        title="Configurações da Homepage"
        subtitle="Controle o que aparece nos cards de vagas do portal público."
      />
      <HomepageConfigForm initialConfig={config ?? DEFAULT_CONFIG} />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        <Link
          href="/configuracoes/funil"
          className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 hover:border-wg-green/50 hover:bg-wg-green/5 transition-colors"
        >
          <div className="h-9 w-9 rounded-lg bg-wg-green/15 text-wg-green-dark grid place-items-center mb-3">
            <ListChecks className="w-4 h-4" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Funil de seleção</h2>
          <p className="text-sm text-gray-500 mt-1">
            Etapas do processo seletivo (colunas do Kanban de candidatos de todas as vagas).
          </p>
        </Link>

        <Link
          href="/configuracoes/formulario-vaga"
          className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 hover:border-wg-green/50 hover:bg-wg-green/5 transition-colors"
        >
          <div className="h-9 w-9 rounded-lg bg-wg-green/15 text-wg-green-dark grid place-items-center mb-3">
            <ClipboardList className="w-4 h-4" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Formulário de abertura de vaga</h2>
          <p className="text-sm text-gray-500 mt-1">
            Campos, título e opções do formulário que os gestores preenchem para solicitar vagas.
          </p>
        </Link>

        <Link
          href="/configuracoes/divulgacao"
          className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 hover:border-wg-green/50 hover:bg-wg-green/5 transition-colors"
        >
          <div className="h-9 w-9 rounded-lg bg-wg-green/15 text-wg-green-dark grid place-items-center mb-3">
            <Megaphone className="w-4 h-4" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Divulgação de vagas</h2>
          <p className="text-sm text-gray-500 mt-1">
            Conexões com canais externos (LinkedIn) para divulgar as vagas.
          </p>
        </Link>
      </div>
    </div>
  );
}
