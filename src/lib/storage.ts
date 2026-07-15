// Storage de currículos — Vercel Blob (privado).
//
// LGPD: os currículos são gravados com `access: "private"`, ou seja, NÃO são
// acessíveis por URL pública. O download só acontece server-side, na área
// autenticada, via getResumeStream() (que usa o BLOB_READ_WRITE_TOKEN).
//
// Requer a variável de ambiente BLOB_READ_WRITE_TOKEN (provisionada ao
// habilitar o Vercel Blob no projeto). Em ambiente sem o token configurado,
// uploadResume() lança um erro claro em vez de falhar silenciosamente.

import { put, get, del } from "@vercel/blob";

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
function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

// O SDK do Blob aceita duas formas de auth:
//  1. BLOB_READ_WRITE_TOKEN (token estático), OU
//  2. OIDC: VERCEL_OIDC_TOKEN + BLOB_STORE_ID — usado pelo fluxo gerenciado da
//     Vercel (injetado automaticamente em runtime na Vercel; localmente vem do
//     `vercel env pull`). Só lançamos erro quando NENHUMA credencial existe.
function assertToken() {
  const configured =
    !!process.env.BLOB_READ_WRITE_TOKEN ||
    !!process.env.BLOB_STORE_ID || // fluxo OIDC (token resolvido pelo SDK/runtime)
    !!process.env.VERCEL; // em runtime na Vercel o OIDC é injetado automaticamente
  if (!configured) {
    throw new Error(
      "Credenciais do Vercel Blob ausentes. Habilite o Blob no projeto (conexão OIDC define BLOB_STORE_ID) ou configure BLOB_READ_WRITE_TOKEN."
    );
  }
}

export interface UploadedResume {
  url: string;
  name: string;
}

/**
 * Faz upload privado do currículo. Retorna a URL (privada) do blob e o nome
 * original do arquivo. Valide o arquivo com validateResumeFile() antes de chamar.
 */
export async function uploadResume(file: File, jobId: string): Promise<UploadedResume> {
  assertToken();

  const safeName = sanitizeFileName(file.name) || "curriculo";
  const pathname = `resumes/${jobId}/${safeName}`;

  const blob = await put(pathname, file, {
    access: "private",
    addRandomSuffix: true, // evita colisão e enumeração de URLs
    contentType: file.type || "application/octet-stream",
  });

  return { url: blob.url, name: file.name };
}

/**
 * Lê um currículo privado server-side (para a rota de download autenticada do RH).
 * Retorna o stream e os headers do blob. NUNCA exponha a URL bruta ao cliente.
 */
export async function getResumeStream(url: string) {
  assertToken();
  return get(url, { access: "private" });
}

/** Exclui um currículo do storage (ex.: ao remover a candidatura — retenção LGPD). */
export async function deleteResume(url: string): Promise<void> {
  assertToken();
  await del(url);
}
