import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import { FormConfigEditor } from "@/components/internal/FormConfigEditor";
import type { FormConfig } from "@/types/form-config";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Formulário de Abertura de Vaga — Configurações" };

async function loadConfig(): Promise<FormConfig> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("job_request_form_config")
    .select("title, description, fields")
    .eq("id", "singleton")
    .maybeSingle();

  if (!data) return DEFAULT_FORM_CONFIG;
  return {
    title: data.title ?? DEFAULT_FORM_CONFIG.title,
    description: data.description ?? DEFAULT_FORM_CONFIG.description,
    fields: Array.isArray(data.fields) ? data.fields : DEFAULT_FORM_CONFIG.fields,
  };
}

export default async function FormularioVagaConfigPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  const config = await loadConfig();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Formulário de Solicitação de Vaga</h1>
        <p className="text-gray-500 text-sm mt-1">
          Título, texto de apresentação e <strong>perguntas complementares</strong> do formulário
          que os gestores preenchem em <code>/solicitar-vaga</code>.
        </p>
        <div className="mt-3 rounded-lg border border-wg-green/30 bg-wg-green/5 px-4 py-3">
          <p className="text-xs text-gray-600">
            Os campos principais do pedido — título, área, unidade, gestor, quantidade, motivo,
            justificativa e condições da vaga — são fixos: viraram campos estruturados da
            solicitação para permitir filtro, aprovação e histórico. Aqui você acrescenta
            perguntas extras específicas da WG; as respostas aparecem na tela da solicitação.
          </p>
        </div>
      </div>

      <FormConfigEditor initialConfig={config} />
    </div>
  );
}
