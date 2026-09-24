import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activity/log";
import { documentIntakeMove, type IntakeStage } from "./document-intake";

/**
 * Candidato mexeu no formulário digital (1º documento ou envio final): leva a admissão
 * para a etapa de recebimento dos documentos, se ela ainda estiver antes dela (regra em
 * document-intake.ts). Compare-and-swap no WHERE — se o RH mover ao mesmo tempo, vale o RH.
 * Nunca lança: falha aqui não pode barrar o upload nem o envio do candidato.
 */
export async function advanceToDocumentIntake(
  supabase: SupabaseClient,
  admissionId: string,
  trigger: "upload" | "submit"
): Promise<void> {
  try {
    const [{ data: stages }, { data: admission }] = await Promise.all([
      supabase.from("admission_stages").select("id, name, sortOrder, active, isFinal, isDocumentIntake"),
      supabase.from("admissions").select("stageId, fullName").eq("id", admissionId).maybeSingle(),
    ]);
    if (!stages || !admission) return;

    const move = documentIntakeMove(stages as IntakeStage[], (admission.stageId as string | null) ?? null);
    if (!move) return;

    let update = supabase.from("admissions").update({ stageId: move.to.id }).eq("id", admissionId);
    update = move.from ? update.eq("stageId", move.from.id) : update.is("stageId", null);
    const { data: rows, error } = await update.select("id");
    if (error || !rows?.length) return;

    const from = move.from?.name ?? "Sem etapa";
    await logActivity(supabase, {
      action: "STAGE_CHANGED",
      entity: "ADMISSION",
      entityId: admissionId,
      admissionId,
      userId: null,
      description: `${from} → ${move.to.name} (automático: ${trigger === "submit" ? "formulário enviado" : "candidato enviou documentos"})`,
      metadata: { from, to: move.to.name, subjectName: admission.fullName as string, automatic: true, trigger },
    });
  } catch (err) {
    console.error("[admissao] avanço automático para a etapa de documentos", err);
  }
}
