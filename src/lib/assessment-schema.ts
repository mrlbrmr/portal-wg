// Vocabulário e validação das AVALIAÇÕES de candidato (entrevistas/testes/IA).
import { z } from "zod";

export const AssessmentKind = {
  INTERVIEW: "INTERVIEW",
  TECHNICAL_TEST: "TECHNICAL_TEST",
  PERSONALITY_TEST: "PERSONALITY_TEST",
  AI_FIT: "AI_FIT",
  REFERENCE: "REFERENCE",
  OTHER: "OTHER",
} as const;
export type AssessmentKind = (typeof AssessmentKind)[keyof typeof AssessmentKind];

export const ASSESSMENT_KIND_LABELS: Record<string, string> = {
  INTERVIEW: "Entrevista",
  TECHNICAL_TEST: "Teste técnico",
  PERSONALITY_TEST: "Teste de personalidade",
  AI_FIT: "Análise por IA",
  REFERENCE: "Referência",
  OTHER: "Outro",
};

// Tipos que o RH registra manualmente (IA fica de fora — é escrita pelo pipeline).
export const MANUAL_ASSESSMENT_KINDS: AssessmentKind[] = [
  AssessmentKind.INTERVIEW,
  AssessmentKind.TECHNICAL_TEST,
  AssessmentKind.PERSONALITY_TEST,
  AssessmentKind.REFERENCE,
  AssessmentKind.OTHER,
];

export const AssessmentOutcome = {
  PENDING: "PENDING",
  PASS: "PASS",
  FAIL: "FAIL",
  RECOMMEND: "RECOMMEND",
  REJECT: "REJECT",
} as const;
export type AssessmentOutcome = (typeof AssessmentOutcome)[keyof typeof AssessmentOutcome];

export const ASSESSMENT_OUTCOME_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PASS: "Aprovado",
  FAIL: "Reprovado",
  RECOMMEND: "Recomendado",
  REJECT: "Não recomendado",
};

// Cor do badge de resultado (parecer).
export const ASSESSMENT_OUTCOME_BADGE: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  PASS: "bg-wg-green/15 text-wg-green-dark",
  RECOMMEND: "bg-wg-green/15 text-wg-green-dark",
  FAIL: "bg-red-100 text-red-700",
  REJECT: "bg-red-100 text-red-700",
};

// Campos aceitos ao criar/editar uma avaliação manual.
export const assessmentInputSchema = z.object({
  kind: z.enum(MANUAL_ASSESSMENT_KINDS as [string, ...string[]]),
  title: z.string().trim().max(160).optional().nullable(),
  score: z.coerce.number().min(0).max(100).optional().nullable(),
  outcome: z.enum(["PENDING", "PASS", "FAIL", "RECOMMEND", "REJECT"]).optional().nullable(),
  summary: z.string().trim().max(5000).optional().nullable(),
  evaluator: z.string().trim().max(120).optional().nullable(),
  occurredAt: z.string().optional().nullable(), // ISO date (yyyy-mm-dd) ou datetime
});
