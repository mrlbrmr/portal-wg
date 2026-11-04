import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLastConfigChange } from "@/lib/settings/audit";
import { loadProcessTemplates } from "@/lib/selection-funnel/process-data";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";
import { ProcessTemplatesManager } from "@/components/internal/funnel/ProcessTemplatesManager";

export const metadata: Metadata = { title: "Modelos de processo — Configurações — RH" };

export default async function ProcessosPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const [templates, { data: stages }, { data: used }, lastChange] = await Promise.all([
    loadProcessTemplates(supabase),
    supabase
      .from("application_stages")
      .select("id, name, color, kind")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
    supabase.from("jobs").select("processTemplateId").not("processTemplateId", "is", null),
    getLastConfigChange("processos"),
  ]);

  const jobsByTemplate = new Map<string, number>();
  for (const j of (used ?? []) as Array<{ processTemplateId: string }>) {
    jobsByTemplate.set(j.processTemplateId, (jobsByTemplate.get(j.processTemplateId) ?? 0) + 1);
  }

  return (
    <SettingsPage
      breadcrumb={[{ label: "Recrutamento" }, { label: "Modelos de processo" }]}
      title="Modelos de processo"
      description="Monte funis prontos para cada tipo de vaga e escolha um deles ao configurar o processo seletivo. O modelo é copiado para a vaga: editar ou arquivar um modelo não altera vagas já configuradas."
      lastChange={lastChange}
    >
      <ProcessTemplatesManager
        templates={templates.map((t) => ({ ...t, jobs: jobsByTemplate.get(t.id) ?? 0 }))}
        catalog={(stages ?? []) as Array<{ id: string; name: string; color: string; kind: string }>}
      />
    </SettingsPage>
  );
}
