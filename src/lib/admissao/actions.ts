"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionWrite } from "./permissions";
import { deleteAdmissionAttachment } from "./storage";
import { validateAttachmentWithAI, type AiValidationOutcome } from "./ai-validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireWrite(): Promise<{ userId: string } | { error: string }> {
  const a = await requireAdmissionWrite();
  if (!a.ok) return { error: a.status === 401 ? "Não autenticado." : "Sem permissão." };
  return { userId: a.userId };
}

function done(admissionId: string): ActionResult {
  revalidatePath(`/admissoes/${admissionId}`);
  revalidateTag("admissoes-widget");
  return { ok: true };
}

// ─── Anexos ───────────────────────────────────────────────────────────────────

export async function updateAttachmentCategory(
  admissionId: string,
  attachmentId: string,
  documentTypeId: string | null
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  const supabase = await createClient();
  await supabase
    .from("admission_attachments")
    .update({ documentTypeId: documentTypeId || null })
    .eq("id", attachmentId)
    .eq("admissionId", admissionId);
  return done(admissionId);
}

export async function deleteAttachment(admissionId: string, attachmentId: string): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: att } = await supabase
    .from("admission_attachments")
    .select("id, blobUrl")
    .eq("id", attachmentId)
    .eq("admissionId", admissionId)
    .maybeSingle();
  if (!att) return { ok: false, error: "Anexo não encontrado." };

  try {
    await deleteAdmissionAttachment(att.blobUrl);
  } catch {
    // Segue removendo o registro mesmo se o blob já não existir.
  }
  await supabase.from("admission_attachments").delete().eq("id", att.id);
  return done(admissionId);
}

/**
 * Revisão manual do RH: aprova, recusa (motivo obrigatório) ou desfaz (decision = null)
 * a decisão sobre um ou mais anexos. A decisão humana prevalece sobre o parecer da IA.
 */
export async function reviewAttachments(
  admissionId: string,
  attachmentIds: string[],
  decision: "approved" | "rejected" | null,
  reason?: string
): Promise<ActionResult> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (attachmentIds.length === 0) return { ok: false, error: "Nenhum documento selecionado." };

  const trimmed = reason?.trim() ?? "";
  if (decision === "rejected" && trimmed.length < 3) return { ok: false, error: "Informe o motivo da recusa." };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("admission_attachments")
    .update({
      reviewStatus: decision,
      reviewReason: decision === "rejected" ? trimmed : null,
      reviewedById: decision ? auth.userId : null,
      reviewedAt: decision ? new Date().toISOString() : null,
    })
    .in("id", attachmentIds)
    .eq("admissionId", admissionId)
    .select("fileName, admission_document_types(name)");
  if (error) return { ok: false, error: "Não foi possível salvar a revisão." };
  if (!updated?.length) return { ok: false, error: "Documento não encontrado." };

  const names = [
    ...new Set(
      updated.map((r) => {
        const dt = r.admission_document_types as { name?: string } | { name?: string }[] | null;
        return (Array.isArray(dt) ? dt[0]?.name : dt?.name) ?? r.fileName;
      })
    ),
  ].join(", ");
  const verb = decision === "approved" ? "aprovado" : decision === "rejected" ? "recusado" : "voltou para revisão";
  await supabase.from("admission_activity_log").insert({
    admissionId,
    userId: auth.userId,
    entity: "ADMISSION_ATTACHMENT",
    action: decision === "approved" ? "DOC_APPROVED" : decision === "rejected" ? "DOC_REJECTED" : "DOC_REVIEW_UNDONE",
    description:
      updated.length === 1 || names.split(", ").length === 1
        ? `Documento ${verb}: ${names}${decision === "rejected" ? ` — ${trimmed}` : ""}`
        : `${updated.length} documentos ${decision === null ? "voltaram para revisão" : `${verb}s`}: ${names}`,
  });

  return done(admissionId);
}

/**
 * Refaz a validação por IA dos anexos que ainda não foram aprovados — útil quando a IA
 * esteve indisponível (sem créditos, instabilidade) no momento do envio.
 */
export async function revalidateAttachmentsWithAI(
  admissionId: string
): Promise<ActionResult & { approved?: number; total?: number }> {
  const auth = await requireWrite();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("admission_attachments")
    .select("id, blobUrl, mimeType, documentTypeId, aiStatus, admission_document_types(name)")
    .eq("admissionId", admissionId)
    .is("reviewStatus", null) // decisão manual do RH prevalece — não gasta IA com ela
    .or("aiStatus.is.null,aiStatus.neq.approved");

  const targets = (rows ?? []).filter((r) => r.mimeType?.startsWith("image/") || r.mimeType === "application/pdf");
  if (targets.length === 0) return { ok: false, error: "Nenhum documento pendente de validação." };

  const outcomes: AiValidationOutcome[] = [];
  const queue = [...targets];
  async function worker() {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const dt = r.admission_document_types as { name?: string } | { name?: string }[] | null;
      const typeName = (Array.isArray(dt) ? dt[0]?.name : dt?.name) ?? "documento";
      outcomes.push(await validateAttachmentWithAI(r.id, r.blobUrl, r.mimeType ?? "", typeName));
    }
  }
  // Concorrência baixa: o plano gratuito do Gemini limita requisições por minuto.
  await Promise.all(Array.from({ length: Math.min(2, targets.length) }, worker));

  done(admissionId);
  if (outcomes.every((o) => o === "unavailable"))
    return { ok: false, error: "A IA continua indisponível. Veja o motivo em cada documento." };
  return { ok: true, approved: outcomes.filter((o) => o === "approved").length, total: targets.length };
}
