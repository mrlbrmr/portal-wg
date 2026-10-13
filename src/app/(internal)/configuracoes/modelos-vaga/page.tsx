import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getLastConfigChange } from "@/lib/settings/audit";
import { loadJobTemplates } from "@/lib/jobs/template-data";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";
import { JobTemplatesManager } from "@/components/internal/job/JobTemplatesManager";

export const metadata: Metadata = { title: "Modelos de vaga — Configurações — RH" };

export default async function ModelosVagaPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const [templates, lastChange] = await Promise.all([loadJobTemplates(), getLastConfigChange("modelos-vaga")]);

  return (
    <SettingsPage
      breadcrumb={[{ label: "Modelos de vaga" }]}
      title="Modelos de vaga"
      description="Cadastre uma vez o que se repete em cada cargo e aplique em Nova vaga. O modelo é copiado para a vaga: editar ou arquivar um modelo não altera vagas já criadas."
      lastChange={lastChange}
    >
      <JobTemplatesManager templates={templates} />
    </SettingsPage>
  );
}
