// Validações e vocabulário compartilhados de candidaturas — usados tanto pela
// rota PÚBLICA (formulário do portal) quanto pela inserção MANUAL do RH.
import { z } from "zod";
import { isValidCpf } from "@/lib/cpf";

// E-mail no formato xxxx@xxxx.com
export const applicantEmailSchema = z.string().trim().email("E-mail inválido").max(150);

// Celular: aceita a máscara (xx) x xxxx-xxxx — validamos pelos 11 dígitos.
export const applicantPhoneSchema = z
  .string()
  .trim()
  .refine((v) => v.replace(/\D/g, "").length === 11, "Celular inválido. Use o formato (xx) x xxxx-xxxx.");

export const applicantNameSchema = z.string().trim().min(3, "Informe o nome completo").max(120);

export const applicantCpfSchema = z
  .string()
  .trim()
  .refine((v) => isValidCpf(v), "CPF inválido. Verifique o número digitado.");

// Campos comuns de contato do candidato (nome/email/telefone).
export const applicantContactSchema = z.object({
  fullName: applicantNameSchema,
  email: applicantEmailSchema,
  phone: applicantPhoneSchema,
});

// Origem da candidatura (applications.source). PORTAL e BANCO_TALENTOS são origens de
// SISTEMA (inscrição pública / adicionado pelo Banco de Talentos). As origens do cadastro
// manual vêm do cadastro `application_sources` (Configurações › Cadastros › Origens de
// candidatos) — lidas em src/lib/application-sources.ts.
export const ApplicationSource = {
  PORTAL: "PORTAL",
  BANCO_TALENTOS: "BANCO_TALENTOS",
} as const;
export type ApplicationSource = (typeof ApplicationSource)[keyof typeof ApplicationSource];

/**
 * Rótulos conhecidos sem consultar o banco: as origens de sistema e as que já existiam
 * antes do cadastro. Origem criada pelo RH só tem rótulo pelo cadastro — por isso as
 * telas recebem `sourceLabel` montado no servidor.
 */
export const APPLICATION_SOURCE_LABELS: Record<string, string> = {
  PORTAL: "Portal",
  WHATSAPP: "WhatsApp",
  CATHO: "Catho",
  INDEED: "Indeed",
  INTERNAL_REFERRAL: "Indicação",
  OTHER: "Outro",
  BANCO_TALENTOS: "Banco de Talentos",
};

export const MAX_SOURCE_NAME = 60;

/** Código gravado em applications.source para uma origem nova ("Vagas.com" → "VAGAS_COM"). */
export function sourceCodeFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
