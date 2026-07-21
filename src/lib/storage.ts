// Storage de currículos — Supabase Storage (bucket privado `resumes`).
//
// LGPD: o bucket é privado (public = false). O upload/download/remove acontecem
// server-side via service_role (admin client). O download só ocorre na área
// autenticada, transmitido pelo servidor via getResumeBlob() — a URL/objeto bruto
// NUNCA é exposto ao cliente. No banco guardamos o **caminho do objeto** dentro
// do bucket (coluna resumeUrl), não uma URL pública.

import { createAdminClient } from "@/lib/supabase/admin";

export const RESUMES_BUCKET = "resumes";

// Tipos de arquivo aceitos para currículo
export const ALLOWED_RESUME_MIME = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
] as const;

export const ALLOWED_RESUME_EXT = [".pdf", ".doc", ".docx"] as const;

export const MAX_RESUME_MB = 5;
export const MAX_RESUME_BYTES = MAX_RESUME_MB * 1024 * 1024;

export interface ResumeValidationResult {
  ok: boolean;
  error?: string;
}

/** Valida tipo e tamanho do currículo antes do upload. */
export function validateResumeFile(file: File): ResumeValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, error: "Arquivo de currículo vazio ou ausente." };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { ok: false, error: `O currículo excede o limite de ${MAX_RESUME_MB} MB.` };
  }

  const name = file.name.toLowerCase();
  const extOk = ALLOWED_RESUME_EXT.some((ext) => name.endsWith(ext));
  const mimeOk = (ALLOWED_RESUME_MIME as readonly string[]).includes(file.type);

  // Aceita se a extensão OU o mime baterem (alguns navegadores enviam mime vazio).
  if (!extOk && !mimeOk) {
    return { ok: false, error: "Formato inválido. Envie um arquivo PDF, DOC ou DOCX." };
  }

  return { ok: true };
}

/** Remove caracteres perigosos do nome do arquivo para compor o pathname. */
export function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

/** Compõe um caminho único dentro do bucket (evita colisão e enumeração). */
export function buildObjectPath(prefix: string, fileName: string, fallback: string): string {
  const safeName = sanitizeFileName(fileName) || fallback;
  const unique = crypto.randomUUID().slice(0, 8);
  return `${prefix}/${unique}-${safeName}`;
}

export interface UploadedResume {
  /** Caminho do objeto dentro do bucket (persistido em resumeUrl). */
  url: string;
  name: string;
}

/**
 * Faz upload privado do currículo. Retorna o caminho do objeto no bucket e o
 * nome original do arquivo. Valide com validateResumeFile() antes de chamar.
 */
export async function uploadResume(file: File, jobId: string): Promise<UploadedResume> {
  const path = buildObjectPath(jobId, file.name, "curriculo");

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(RESUMES_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    throw new Error(`Falha ao enviar o currículo: ${error.message}`);
  }

  return { url: path, name: file.name };
}

/**
 * Baixa um currículo privado server-side (rota de download autenticada do RH).
 * Retorna o Blob (com contentType) ou null. NUNCA exponha o objeto ao cliente.
 */
export async function getResumeBlob(path: string): Promise<Blob | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(RESUMES_BUCKET).download(path);
  if (error || !data) return null;
  return data;
}

/** Exclui um currículo do storage (ex.: ao remover a candidatura — retenção LGPD). */
export async function deleteResume(path: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(RESUMES_BUCKET).remove([path]);
}
