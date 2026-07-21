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
        <h1 className="text-2xl font-bold text-gray-900">Formulário de Abertura de Vaga</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure os campos, título e opções do formulário que os gestores preenchem para solicitar
          abertura de vagas.
        </p>
      </div>

      <FormConfigEditor initialConfig={config} />
    </div>
  );
}
