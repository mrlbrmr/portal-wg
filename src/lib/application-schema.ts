// Validações e vocabulário compartilhados de candidaturas — usados tanto pela
// rota PÚBLICA (formulário do portal) quanto pela inserção MANUAL do RH.
import { z } from "zod";

// E-mail no formato xxxx@xxxx.com
export const applicantEmailSchema = z.string().trim().email("E-mail inválido").max(150);

// Celular: aceita a máscara (xx) x xxxx-xxxx — validamos pelos 11 dígitos.
export const applicantPhoneSchema = z
  .string()
  .trim()
  .refine((v) => v.replace(/\D/g, "").length === 11, "Celular inválido. Use o formato (xx) x xxxx-xxxx.");

export const applicantNameSchema = z.string().trim().min(3, "Informe o nome completo").max(120);

// Campos comuns de contato do candidato (nome/email/telefone).
export const applicantContactSchema = z.object({
  fullName: applicantNameSchema,
  email: applicantEmailSchema,
  phone: applicantPhoneSchema,
});

// Origem da candidatura. PORTAL = inscrição pública; os demais são cadastros
// manuais do RH (CV recebido por fora).
export const ApplicationSource = {
  PORTAL: "PORTAL",
  WHATSAPP: "WHATSAPP",
  CATHO: "CATHO",
  INDEED: "INDEED",
  INTERNAL_REFERRAL: "INTERNAL_REFERRAL",
  OTHER: "OTHER",
} as const;
export type ApplicationSource = (typeof ApplicationSource)[keyof typeof ApplicationSource];

// Origens que o RH pode escolher ao cadastrar manualmente (exclui PORTAL).
export const MANUAL_APPLICATION_SOURCES: ApplicationSource[] = [
  ApplicationSource.WHATSAPP,
  ApplicationSource.CATHO,
  ApplicationSource.INDEED,
  ApplicationSource.INTERNAL_REFERRAL,
  ApplicationSource.OTHER,
];

export const APPLICATION_SOURCE_LABELS: Record<string, string> = {
  PORTAL: "Portal",
  WHATSAPP: "WhatsApp",
  CATHO: "Catho",
  INDEED: "Indeed",
  INTERNAL_REFERRAL: "Indicação",
  OTHER: "Outro",
};
