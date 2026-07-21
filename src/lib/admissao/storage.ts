// Storage de anexos de admissão — Supabase Storage (bucket privado
// `admission-attachments`).
//
// Reaproveita os helpers de `@/lib/storage` (sanitização / caminho de objeto /
// admin client). Diferente dos currículos, aqui aceitamos também imagens (foto
// 3x4, RG/CNH fotografados) além de PDF/DOC. Acesso sempre privado: download só
// server-side em rota autenticada. NUNCA exponha o objeto bruto ao cliente. No
// banco guardamos o **caminho do objeto** no bucket (coluna blobUrl).

import { createAdminClient } from "@/lib/supabase/admin";
import { buildObjectPath } from "@/lib/storage";

export const ATTACHMENTS_BUCKET = "admission-attachments";

export const ALLOWED_ATTACHMENT_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
] as const;

export const ALLOWED_ATTACHMENT_EXT = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
] as const;

export const MAX_ATTACHMENT_MB = 10;
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

export interface AttachmentValidationResult {
  ok: boolean;
  error?: string;
}

/** Valida tipo e tamanho de um anexo de admissão antes do upload. */
export function validateAttachmentFile(file: File): AttachmentValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, error: "Arquivo vazio ou ausente." };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `O arquivo excede o limite de ${MAX_ATTACHMENT_MB} MB.` };
  }

  const name = file.name.toLowerCase();
  const extOk = ALLOWED_ATTACHMENT_EXT.some((ext) => name.endsWith(ext));
  const mimeOk = (ALLOWED_ATTACHMENT_MIME as readonly string[]).includes(file.type);

  // Aceita se extensão OU mime baterem (alguns navegadores enviam mime vazio).
  if (!extOk && !mimeOk) {
    return { ok: false, error: "Formato inválido. Envie PDF, imagem (JPG/PNG/WEBP) ou DOC/DOCX." };
  }

  return { ok: true };
}

export interface UploadedAttachment {
  /** Caminho do objeto dentro do bucket (persistido em blobUrl). */
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Faz upload privado de um anexo de admissão. Valide com
 * validateAttachmentFile() antes de chamar. Retorna o caminho do objeto e
 * metadados para persistir em AdmissionAttachment.
 */
export async function uploadAdmissionAttachment(
  file: File,
  admissionId: string
): Promise<UploadedAttachment> {
  const path = buildObjectPath(admissionId, file.name, "documento");
  const mimeType = file.type || "application/octet-stream";

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(`Falha ao enviar o anexo: ${error.message}`);
  }

  return { url: path, name: file.name, mimeType, sizeBytes: file.size };
}

/** Baixa um anexo privado server-side (rota de download autenticada). */
export async function getAdmissionAttachmentBlob(path: string): Promise<Blob | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).download(path);
  if (error || !data) return null;
  return data;
}

/** Exclui um anexo do storage (ex.: ao remover o anexo ou a admissão). */
export async function deleteAdmissionAttachment(path: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
}
