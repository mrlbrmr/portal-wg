// Storage de anexos de admissão — Vercel Blob (privado).
//
// Substitui o bucket `admission-files` do Supabase Storage. Reaproveita os
// helpers de `@/lib/storage` (sanitização e checagem de credencial do Blob).
// Diferente dos currículos, aqui aceitamos também imagens (foto 3x4, RG/CNH
// fotografados) além de PDF/DOC. Acesso sempre privado: download só server-side
// em rota autenticada. NUNCA exponha a URL bruta ao cliente.

import { put, get, del } from "@vercel/blob";
import { sanitizeFileName, assertBlobConfigured } from "@/lib/storage";

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
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Faz upload privado de um anexo de admissão. Valide com
 * validateAttachmentFile() antes de chamar. Retorna a URL (privada) do blob e
 * metadados para persistir em AdmissionAttachment.
 */
export async function uploadAdmissionAttachment(
  file: File,
  admissionId: string
): Promise<UploadedAttachment> {
  assertBlobConfigured();

  const safeName = sanitizeFileName(file.name) || "documento";
  const pathname = `admissions/${admissionId}/${safeName}`;

  const blob = await put(pathname, file, {
    access: "private",
    addRandomSuffix: true, // evita colisão e enumeração de URLs
    contentType: file.type || "application/octet-stream",
  });

  return {
    url: blob.url,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

/** Lê um anexo privado server-side (rota de download autenticada). */
export async function getAdmissionAttachmentStream(url: string) {
  assertBlobConfigured();
  return get(url, { access: "private" });
}

/** Exclui um anexo do storage (ex.: ao remover o anexo ou a admissão). */
export async function deleteAdmissionAttachment(url: string): Promise<void> {
  assertBlobConfigured();
  await del(url);
}
