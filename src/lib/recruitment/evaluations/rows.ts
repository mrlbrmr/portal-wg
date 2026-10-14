// Entrada validada → colunas de application_assessments — módulo PURO.
// Cada tipo grava só as suas colunas e LIMPA as dos outros tipos (um registro editado
// nunca fica com sobra de outro tipo). Score/outcome antigos não são tocados aqui.

import { interviewTypeLabel } from "./catalog";
import { sanitizeReportDoc } from "./document";
import { dayToTimestamp, type EvaluationInput } from "./schema";

export type EvaluationRow = Record<string, unknown>;

const EMPTY_INTERVIEW = { interviewType: null, recommendation: null, content: null, contentText: null };
const EMPTY_REFERENCE = { referenceCompany: null, referenceContact: null, referenceRelationship: null, referenceResult: null };

export function buildEvaluationRow(input: EvaluationInput): { ok: true; row: EvaluationRow } | { ok: false; error: string } {
  const occurredAt = dayToTimestamp(input.occurredAt);
  if (input.kind === "INTERVIEW") {
    const doc = sanitizeReportDoc(input.content);
    if (!doc.ok) return { ok: false, error: doc.error };
    return {
      ok: true,
      row: {
        ...EMPTY_REFERENCE,
        kind: "INTERVIEW",
        title: input.title ?? interviewTypeLabel(input.interviewType),
        interviewType: input.interviewType,
        recommendation: input.recommendation,
        evaluator: input.evaluator,
        occurredAt,
        content: doc.doc,
        contentText: doc.text,
      },
    };
  }
  if (input.kind === "REFERENCE") {
    return {
      ok: true,
      row: {
        ...EMPTY_INTERVIEW,
        kind: "REFERENCE",
        title: `Referência · ${input.referenceCompany}`.slice(0, 160),
        referenceCompany: input.referenceCompany,
        referenceContact: input.referenceContact,
        referenceRelationship: input.referenceRelationship,
        referenceResult: input.referenceResult,
        summary: input.summary,
        evaluator: null,
        occurredAt,
      },
    };
  }
  return {
    ok: true,
    row: {
      ...EMPTY_INTERVIEW,
      ...EMPTY_REFERENCE,
      kind: "OTHER",
      title: input.title,
      evaluator: input.evaluator,
      summary: input.summary,
      occurredAt,
    },
  };
}
