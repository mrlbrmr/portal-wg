import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { loadJobRequestFormConfig } from "@/lib/job-requests/form-config-loader";
import { getLastConfigChange } from "@/lib/settings/audit";
import { FormConfigEditor } from "@/components/internal/FormConfigEditor";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";

export const metadata: Metadata = { title: "Solicitação de vaga — Configurações — RH" };

export default async function FormularioVagaConfigPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  const [{ title, description, fields }, lastChange] = await Promise.all([
    loadJobRequestFormConfig(),
    getLastConfigChange("formulario-vaga"),
  ]);

  return (
    <SettingsPage
      breadcrumb={[{ label: "Recrutamento" }, { label: "Solicitação de vaga" }]}
      title="Solicitação de vaga"
      description="Formulário que os gestores preenchem para pedir uma nova contratação."
      lastChange={lastChange}
    >
      <FormConfigEditor initialConfig={{ title, description, fields }} />
    </SettingsPage>
  );
}
