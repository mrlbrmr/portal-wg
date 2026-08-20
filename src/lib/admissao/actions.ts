"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionWrite } from "./permissions";
import { deleteAdmissionAttachment } from "./storage";

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
