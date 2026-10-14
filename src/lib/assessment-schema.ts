// Vocabulário de application_assessments.kind (registros da candidatura).
//
// Entrevista (com parecer), referência e avaliação externa são registradas por pessoas;
// a validação e os campos de cada tipo ficam em src/lib/recruitment/evaluations/.
// TECHNICAL_TEST/PERSONALITY_TEST existem só em registros antigos: testes do Portal têm
// fonte única em assessment_sessions e não são mais registrados aqui.

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
  TECHNICAL_TEST: "Teste técnico (registro anterior)",
  PERSONALITY_TEST: "Teste de personalidade (registro anterior)",
  AI_FIT: "Análise por IA",
  REFERENCE: "Referência",
  OTHER: "Avaliação externa",
};
