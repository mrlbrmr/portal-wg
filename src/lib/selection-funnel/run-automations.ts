// Execução, no servidor, das automações de ENTRADA na etapa (ver automations.ts).
//
// Chamado depois que a candidatura mudou de etapa. Falhas aqui nunca desfazem a
// mudança de etapa — a automação é um complemento; o RH ainda pode agir à mão.

import type { createClient } from "@/lib/supabase/server";
import { isAutomationOn } from "./automations";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface AutomationReport {
  /** Link do teste criado automaticamente (etapa Teste com a automação ligada). */
  testLinkCreated?: boolean;
}

export async function runStageEntryAutomations(
  supabase: Supabase,
  input: { applicationId: string; stageId: string; actorName: string }
): Promise<AutomationReport> {
  const report: AutomationReport = {};
  try {
    const { data: stage } = await supabase
      .from("application_stages")
      .select("kind, templateId, automations")
      .eq("id", input.stageId)
      .maybeSingle();
    if (!stage) return report;

    if (isAutomationOn(stage, "createTestLink") && stage.templateId) {
      const { data: template } = await supabase
        .from("assessment_templates")
        .select("id, isActive")
        .eq("id", stage.templateId)
        .maybeSingle();
      if (!template?.isActive) return report;

      // Não duplica: se já existe um link deste teste ainda não respondido, reaproveita.
      const { data: pending } = await supabase
        .from("assessment_sessions")
        .select("id, expiresAt")
        .eq("applicationId", input.applicationId)
        .eq("templateId", stage.templateId)
        .is("submittedAt", null)
        .is("invalidadoEm", null);
      const now = Date.now();
      const hasOpenLink = (pending ?? []).some(
        (s) => !s.expiresAt || new Date(s.expiresAt as string).getTime() > now
      );
      if (!hasOpenLink) {
        const { error } = await supabase.from("assessment_sessions").insert({
          applicationId: input.applicationId,
          templateId: stage.templateId,
          expiresAt: null,
          sentBy: input.actorName,
        });
        if (!error) report.testLinkCreated = true;
        else console.warn("[stage-automation] createTestLink", error.message);
      }
    }
  } catch (e) {
    console.warn("[stage-automation]", e);
  }
  return report;
}
