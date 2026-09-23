import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFormConfig } from "@/lib/admissao/form-config-loader";
import { getLastConfigChange } from "@/lib/settings/audit";
import { FormConfigEditor } from "@/components/internal/admissao/FormConfigEditor";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";

export const metadata: Metadata = { title: "Formulário de Admissão Digital — Configurações — RH" };

export default async function FormularioAdmissaoConfigPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const [config, lastChange, { data: docTypes }] = await Promise.all([
    loadFormConfig(),
    getLastConfigChange("formulario-admissao"),
    supabase.from("admission_document_types").select("name"),
  ]);

  return (
    <SettingsPage
      breadcrumb={[{ label: "Admissão" }, { label: "Formulário de Admissão Digital" }]}
      title="Formulário de Admissão Digital"
      description="Formulário que o candidato aprovado preenche pelo link. As alterações valem para os próximos links e para os links ainda não preenchidos."
      lastChange={lastChange}
    >
      <FormConfigEditor
        initial={config}
        documentTypeNames={((docTypes ?? []) as Array<{ name: string }>).map((d) => d.name)}
      />
    </SettingsPage>
  );
}
