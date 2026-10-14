// Vocabulário do hub de AVALIAÇÕES da candidatura — módulo PURO (client-safe).
//
// Uma candidatura é avaliada por:
//   • testes do Portal  → assessment_sessions (fonte única; nunca registrados à mão aqui)
//   • entrevistas       → application_assessments kind=INTERVIEW (entrevista E parecer
//                         são o mesmo registro: tipo, data, entrevistador, recomendação, conteúdo)
//   • referências       → kind=REFERENCE (campos simples, sem editor rico)
//   • avaliações externas → kind=OTHER (único tipo com anexo)
//   • análise de IA     → kind=AI_FIT (escrita pelo pipeline de IA)
//
// Listas abaixo são a regra única (API valida, UI exibe). Para um tipo novo de entrevista
// basta acrescentar em INTERVIEW_TYPES; recomendação e resultado da referência também
// têm check no banco (migração 20261014120000).

export type EvaluationTone = "success" | "info" | "warning" | "danger" | "neutral";

export const INTERVIEW_TYPES = [
  { code: "HR", label: "Entrevista RH" },
  { code: "MANAGER", label: "Entrevista com gestor" },
  { code: "TECHNICAL", label: "Entrevista técnica" },
  { code: "FINAL", label: "Entrevista final" },
  { code: "OTHER", label: "Outra entrevista" },
] as const;
export type InterviewTypeCode = (typeof INTERVIEW_TYPES)[number]["code"];
export const INTERVIEW_TYPE_CODES = INTERVIEW_TYPES.map((t) => t.code) as [InterviewTypeCode, ...InterviewTypeCode[]];

/** Rótulo do tipo; entrevista antiga (sem tipo) = "Entrevista". */
export function interviewTypeLabel(code: string | null | undefined): string {
  if (!code) return "Entrevista";
  return INTERVIEW_TYPES.find((t) => t.code === code)?.label ?? "Entrevista";
}

export const RECOMMENDATIONS = [
  { code: "UNDEFINED", label: "Sem definição", tone: "neutral" },
  { code: "ADVANCE", label: "Avançar", tone: "success" },
  { code: "ADVANCE_WITH_CAVEATS", label: "Avançar com ressalvas", tone: "warning" },
  { code: "TALENT_POOL", label: "Banco de talentos", tone: "info" },
  { code: "DO_NOT_ADVANCE", label: "Não avançar", tone: "danger" },
] as const satisfies ReadonlyArray<{ code: string; label: string; tone: EvaluationTone }>;
export type RecommendationCode = (typeof RECOMMENDATIONS)[number]["code"];
export const RECOMMENDATION_CODES = RECOMMENDATIONS.map((r) => r.code) as [RecommendationCode, ...RecommendationCode[]];

export function recommendationInfo(code: string | null | undefined): { label: string; tone: EvaluationTone } {
  const found = RECOMMENDATIONS.find((r) => r.code === code) ?? RECOMMENDATIONS[0];
  return { label: found.label, tone: found.tone };
}

export const REFERENCE_RESULTS = [
  { code: "POSITIVE", label: "Positiva", tone: "success" },
  { code: "NEUTRAL", label: "Neutra", tone: "neutral" },
  { code: "ATTENTION", label: "Ponto de atenção", tone: "warning" },
] as const satisfies ReadonlyArray<{ code: string; label: string; tone: EvaluationTone }>;
export type ReferenceResultCode = (typeof REFERENCE_RESULTS)[number]["code"];
export const REFERENCE_RESULT_CODES = REFERENCE_RESULTS.map((r) => r.code) as [ReferenceResultCode, ...ReferenceResultCode[]];

export function referenceResultInfo(code: string | null | undefined): { label: string; tone: EvaluationTone } | null {
  const found = REFERENCE_RESULTS.find((r) => r.code === code);
  return found ? { label: found.label, tone: found.tone } : null;
}

/** Grupo do hub em que um registro de application_assessments aparece. */
export type EvaluationGroup = "interview" | "reference" | "external" | "ai" | "hidden";

interface AssessmentLike {
  kind: string;
  source?: string | null;
  evaluator?: string | null;
  metadata?: unknown;
}

/**
 * Cópia de teste online gravada pelas versões antigas (submit/correção do teste).
 * A fonte de verdade é assessment_sessions — a cópia fica no banco, mas não aparece.
 */
export function isTestMirror(a: AssessmentLike): boolean {
  const meta = a.metadata as { sessionId?: unknown } | null | undefined;
  if (meta && typeof meta === "object" && typeof meta.sessionId === "string") return true;
  return (a.kind === "PERSONALITY_TEST" || a.kind === "TECHNICAL_TEST") && a.evaluator === "Automático";
}

export function evaluationGroup(a: AssessmentLike): EvaluationGroup {
  if (isTestMirror(a)) return "hidden";
  if (a.kind === "AI_FIT") return "ai";
  if (a.kind === "INTERVIEW") return "interview";
  if (a.kind === "REFERENCE") return "reference";
  // OTHER e registros manuais antigos de teste técnico/personalidade feitos fora do Portal.
  return "external";
}

/** Avaliações feitas por pessoas (contagem do card do pipeline): sem IA e sem cópias de teste. */
export function isHumanEvaluation(a: AssessmentLike): boolean {
  const g = evaluationGroup(a);
  return g === "interview" || g === "reference" || g === "external";
}
