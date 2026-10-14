// Validação das avaliações registradas por pessoas (entrevista + parecer, referência,
// avaliação externa). Client-safe: a UI valida com as mesmas regras que a API.
//
// Nota 0–100 não existe aqui de propósito: score só onde há escala real (testes do Portal,
// análise de IA). Registros antigos com nota continuam no banco e são só exibidos.

import { z } from "zod";
import { INTERVIEW_TYPE_CODES, RECOMMENDATION_CODES, REFERENCE_RESULT_CODES } from "./catalog";

/** Colunas lidas pelo hub (GET /api/applications/[id]/assessments). */
export const ASSESSMENT_COLUMNS =
  'id, kind, source, title, score, outcome, summary, evaluator, attachmentName, metadata, occurredAt, createdAt, createdBy, "interviewType", recommendation, content, "referenceCompany", "referenceContact", "referenceRelationship", "referenceResult", "authorId", "updatedById", "updatedByName", "updatedAt"';

/** "AAAA-MM-DD" de hoje no fuso de São Paulo. */
export function todayISO(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function isValidDay(value: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  const max = new Date(now.getTime() + 400 * 86_400_000);
  return value >= "2000-01-01" && d <= max;
}

/** Dia (AAAA-MM-DD) → meio-dia UTC, para não "voltar um dia" no fuso BRT. */
export function dayToTimestamp(day: string): string {
  return `${day}T12:00:00Z`;
}

const day = z
  .string({ required_error: "Informe a data." })
  .refine((v) => isValidDay(v), "Data inválida.");
const optionalText = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const interviewInputSchema = z.object({
  kind: z.literal("INTERVIEW"),
  interviewType: z.enum(INTERVIEW_TYPE_CODES, { errorMap: () => ({ message: "Escolha o tipo da entrevista." }) }),
  occurredAt: day,
  recommendation: z.enum(RECOMMENDATION_CODES, { errorMap: () => ({ message: "Recomendação inválida." }) }),
  evaluator: z.string().trim().min(2, "Informe o entrevistador.").max(120, "Nome do entrevistador muito longo."),
  title: optionalText(160, "Título muito longo (máx. 160 caracteres)."),
  /** JSON do editor — validado por sanitizeReportDoc na API. */
  content: z.unknown(),
});

export const referenceInputSchema = z.object({
  kind: z.literal("REFERENCE"),
  referenceCompany: z.string().trim().min(2, "Informe a empresa.").max(160, "Nome da empresa muito longo."),
  referenceContact: z.string().trim().min(2, "Informe a pessoa contatada.").max(120, "Nome muito longo."),
  referenceRelationship: optionalText(120, "Cargo/relação muito longo."),
  occurredAt: day,
  referenceResult: z.enum(REFERENCE_RESULT_CODES, { errorMap: () => ({ message: "Escolha o resultado da referência." }) }),
  summary: optionalText(5000, "Máximo de 5.000 caracteres nas observações."),
});

export const externalInputSchema = z.object({
  kind: z.literal("OTHER"),
  title: z.string().trim().min(2, "Dê um título à avaliação.").max(160, "Título muito longo (máx. 160 caracteres)."),
  occurredAt: day,
  evaluator: optionalText(120, "Nome do avaliador muito longo."),
  summary: optionalText(5000, "Máximo de 5.000 caracteres nas observações."),
});

export const evaluationInputSchema = z.discriminatedUnion("kind", [
  interviewInputSchema,
  referenceInputSchema,
  externalInputSchema,
]);
export type EvaluationInput = z.infer<typeof evaluationInputSchema>;

/** Edição: os mesmos campos + updatedAt lido (compare-and-swap contra edição simultânea). */
export const evaluationPatchSchema = z.object({
  expectedUpdatedAt: z.string().min(10).optional(),
  data: evaluationInputSchema,
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
