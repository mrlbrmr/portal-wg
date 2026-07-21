// Storage dos anexos de AVALIAÇÃO — bucket privado `assessment-files`.
// Mesma garantia LGPD do currículo: bucket privado, acesso só server-side via
// service_role, download por rota autenticada. No banco guarda-se o CAMINHO do objeto.

import { createAdminClient } from "@/lib/supabase/admin";
import { buildObjectPath } from "@/lib/storage";

export const ASSESSMENT_BUCKET = "assessment-files";
export const MAX_ASSESSMENT_MB = 10;
const MAX_BYTES = MAX_ASSESSMENT_MB * 1024 * 1024;
const ALLOWED_EXT = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"] as const;

export function validateAssessmentFile(file: File): { ok: boolean; error?: string } {
  if (!file || file.size === 0) return { ok: false, error: "Arquivo vazio ou ausente." };
  if (file.size > MAX_BYTES) return { ok: false, error: `O anexo excede o limite de ${MAX_ASSESSMENT_MB} MB.` };
  const name = file.name.toLowerCase();
  if (!ALLOWED_EXT.some((ext) => name.endsWith(ext))) {
    return { ok: false, error: "Formato inválido. Envie PDF, DOC, DOCX, PNG ou JPG." };
  }
  return { ok: true };
}

export async function uploadAssessmentFile(
  file: File,
  applicationId: string
): Promise<{ url: string; name: string }> {
  const path = buildObjectPath(applicationId, file.name, "avaliacao");
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(ASSESSMENT_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`Falha ao enviar o anexo: ${error.message}`);
  return { url: path, name: file.name };
}

export async function getAssessmentFileBlob(path: string): Promise<Blob | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(ASSESSMENT_BUCKET).download(path);
  if (error || !data) return null;
  return data;
}

export async function deleteAssessmentFile(path: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(ASSESSMENT_BUCKET).remove([path]);
}
