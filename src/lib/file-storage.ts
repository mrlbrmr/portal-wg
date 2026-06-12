import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "5");
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

export interface UploadResult {
  filePath: string;   // Caminho relativo privado para o banco
  fileName: string;   // Nome original do arquivo
}

export async function saveResume(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  // Validar tipo MIME
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error("Tipo de arquivo não permitido. Envie PDF, DOC ou DOCX.");
  }

  // Validar extensão
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error("Extensão não permitida. Use .pdf, .doc ou .docx.");
  }

  // Validar tamanho
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE_MB}MB.`);
  }

  // Garantir que o diretório existe
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Nome único para evitar colisões (não expõe o nome original no servidor)
  const uniqueName = `${randomUUID()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, uniqueName);

  await fs.writeFile(filePath, buffer);

  return {
    filePath: path.join("uploads", uniqueName), // relativo ao projeto
    fileName: originalName,
  };
}

export async function getResumeBuffer(filePath: string): Promise<Buffer> {
  // Normalizar o caminho para evitar path traversal
  const safePath = path.normalize(filePath);
  if (!safePath.startsWith("uploads")) {
    throw new Error("Acesso negado.");
  }
  return fs.readFile(safePath);
}

export async function deleteResume(filePath: string): Promise<void> {
  const safePath = path.normalize(filePath);
  if (!safePath.startsWith("uploads")) {
    throw new Error("Acesso negado.");
  }
  try {
    await fs.unlink(safePath);
  } catch {
    // Arquivo pode já não existir
  }
}
