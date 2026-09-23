import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getLastConfigChange } from "@/lib/settings/audit";
import { isStageKind } from "@/lib/selection-funnel/automations";
import {
  FunnelStagesManager,
  type FunnelStage,
  type TemplateOption,
} from "@/components/internal/FunnelStagesManager";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";

export const metadata: Metadata = { title: "Funil de seleção — Configurações — RH" };

type StageRow = Omit<FunnelStage, "candidates" | "kind"> & { kind: string };

export default async function FunilPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: stagesData }, { data: templatesData }, lastChange] = await Promise.all([
    supabase
      .from("application_stages")
      .select("id, name, color, sortOrder, kind, active, templateId, hideFromBoard, automations")
      .order("sortOrder", { ascending: true }),
    supabase
      .from("assessment_templates")
      .select("id, name, kind")
      .eq("isActive", true)
      .order("name", { ascending: true }),
    getLastConfigChange("funil"),
  ]);

  const rows = (stagesData ?? []) as StageRow[];

  // Candidatos em cada etapa AGORA (para avisar antes de desativar/excluir).
  const counts = await Promise.all(
    rows.map((s) =>
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("stageId", s.id)
    )
  );

  const stages: FunnelStage[] = rows.map((s, i) => ({
    ...s,
    kind: isStageKind(s.kind) ? s.kind : "OPEN",
    hideFromBoard: s.hideFromBoard ?? false,
    automations: s.automations ?? {},
    candidates: counts[i].count ?? 0,
  }));
  const templates = (templatesData ?? []) as TemplateOption[];

  return (
    <SettingsPage
      breadcrumb={[{ label: "Recrutamento" }, { label: "Funil de seleção" }]}
      title="Funil de seleção"
      description="Configure as etapas utilizadas nos processos seletivos. As etapas de contratação e reprovação são utilizadas para calcular os indicadores de recrutamento."
      lastChange={lastChange}
    >
      <FunnelStagesManager stages={stages} templates={templates} />
    </SettingsPage>
  );
}
