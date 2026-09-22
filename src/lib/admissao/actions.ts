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
  await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker));

  done(admissionId);
  if (outcomes.every((o) => o === "unavailable"))
    return { ok: false, error: "A IA continua indisponível. Veja o motivo em cada documento." };
  return { ok: true, approved: outcomes.filter((o) => o === "approved").length, total: targets.length };
}
