// Vocabulário da AGENDA DE ENTREVISTAS (G&G e Gestor) — módulo PURO (client-safe).
// Uma entrevista agendada vive em application_interviews; o parecer continua em
// application_assessments (kind=INTERVIEW) e é ligado por `assessmentId`.

import type { InterviewTypeCode } from "@/lib/recruitment/evaluations/catalog";

/** Rodadas agendáveis. Os códigos são um subconjunto de InterviewTypeCode (divergência = erro de compilação). */
export const INTERVIEW_ROUNDS = [
  { code: "HR" satisfies InterviewTypeCode, label: "Gente & Gestão", short: "G&G" },
  { code: "MANAGER" satisfies InterviewTypeCode, label: "Gestor", short: "Gestor" },
] as const;
export type InterviewRoundCode = (typeof INTERVIEW_ROUNDS)[number]["code"];
export const INTERVIEW_ROUND_CODES = INTERVIEW_ROUNDS.map((r) => r.code) as [InterviewRoundCode, ...InterviewRoundCode[]];

export const INTERVIEW_STATUSES = [
  { code: "SCHEDULED", label: "Agendada", tone: "info" },
  { code: "DONE", label: "Realizada", tone: "success" },
  { code: "CANCELLED", label: "Cancelada", tone: "neutral" },
  { code: "NO_SHOW", label: "Não compareceu", tone: "warning" },
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number]["code"];
export const INTERVIEW_STATUS_CODES = INTERVIEW_STATUSES.map((s) => s.code) as [InterviewStatus, ...InterviewStatus[]];

export function roundLabel(code: string | null | undefined): string {
  return INTERVIEW_ROUNDS.find((r) => r.code === code)?.label ?? "Entrevista";
}

export function roundShort(code: string | null | undefined): string {
  return INTERVIEW_ROUNDS.find((r) => r.code === code)?.short ?? "Entrevista";
}

export interface InterviewRow {
  id: string;
  applicationId: string;
  round: string;
  scheduledAt: string;
  durationMin: number;
  location: string | null;
  interviewerName: string | null;
  notes: string | null;
  status: InterviewStatus;
  cancelReason: string | null;
  assessmentId: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedByName: string | null;
}

/** Colunas lidas pela API/UI (select do supabase-js). */
export const INTERVIEW_COLUMNS =
  'id, "applicationId", round, "scheduledAt", "durationMin", location, "interviewerName", notes, status, "cancelReason", "assessmentId", "createdAt", "createdBy", "updatedAt", "updatedByName"';
