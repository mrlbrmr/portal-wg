// Respostas do formulário de admissão preenchidas/corrigidas pelo RH (módulo PURO).
// Caso de uso: o candidato não consegue usar o link e manda os documentos por WhatsApp —
// o RH digita as respostas na central e o formulário passa a "Concluído".

import { z } from "zod";

export const SHIRT_SIZES = ["PP", "P", "M", "G", "GG", "EXG", "EXGG"];
export const PANTS_SIZES = ["34", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54", "56", "58", "60"];
export const BOOT_SIZES = ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];

const text = (max: number) => z.string().trim().max(max).nullable().optional();

export const formAnswersSchema = z.object({
  gender: text(60),
  maritalStatus: text(60),
  hasChildren: z.boolean().nullable().optional(),
  needsTransportVoucher: z.boolean().nullable().optional(),
  transportVoucherDetails: text(500),
  hasItauAccount: z.boolean().nullable().optional(),
  bankAgency: text(20),
  bankAccount: text(30),
  colorDeclaration: text(60),
  isDriverOperator: z.boolean().nullable().optional(),
  uniformShirt: text(20),
  noOperationalUniform: z.boolean().nullable().optional(),
  uniformPants: text(20),
  uniformShoe: text(20),
  formExtras: z.record(z.string(), z.string().max(200)).nullable().optional(),
});

export type FormAnswersInput = z.infer<typeof formAnswersSchema>;

const empty = (v: string | null | undefined) => (v && v.length > 0 ? v : null);

/**
 * Normaliza para as colunas de `admissions`: texto vazio vira null e campos que dependem de
 * uma resposta "Sim" são zerados quando a resposta muda para "Não" (sem dado órfão).
 */
export function answersToRow(a: FormAnswersInput) {
  const extras = Object.fromEntries(Object.entries(a.formExtras ?? {}).filter(([, v]) => v.trim() !== ""));
  return {
    gender: empty(a.gender),
    maritalStatus: empty(a.maritalStatus),
    hasChildren: a.hasChildren ?? null,
    needsTransportVoucher: a.needsTransportVoucher ?? null,
    transportVoucherDetails: a.needsTransportVoucher ? empty(a.transportVoucherDetails) : null,
    hasItauAccount: a.hasItauAccount ?? null,
    bankAgency: a.hasItauAccount ? empty(a.bankAgency) : null,
    bankAccount: a.hasItauAccount ? empty(a.bankAccount) : null,
    colorDeclaration: empty(a.colorDeclaration),
    isDriverOperator: a.isDriverOperator ?? null,
    uniformShirt: empty(a.uniformShirt),
    noOperationalUniform: a.noOperationalUniform ?? null,
    uniformPants: a.noOperationalUniform ? null : empty(a.uniformPants),
    uniformShoe: a.noOperationalUniform ? null : empty(a.uniformShoe),
    formExtras: Object.keys(extras).length > 0 ? extras : null,
  };
}
