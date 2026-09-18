import type { JobPriority, JobRequestStatus } from "@/types/domain";

/**
 * Requisição de Pessoal (RP) — o pedido do gestor, ANTES de virar vaga.
 * `formData` guarda o que foi digitado no formulário configurável; as demais
 * colunas são derivadas para listar/filtrar a fila sem abrir o JSON.
 */
export interface JobRequestRow {
  id: string;
  status: JobRequestStatus;
  title: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  reason: string | null;
  location: string | null;
  openings: number | null;
  priority: JobPriority;
  desiredStartDate: string | null; // ISO (date)
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null; // ISO
  jobId: string | null;
  jobTitle: string | null;
  jobStatus: string | null;
  formData: Record<string, string>;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export const JOB_REQUEST_STATUS_LABELS: Record<JobRequestStatus, string> = {
  SUBMITTED: "Solicitada",
  IN_REVIEW: "Em análise",
  RETURNED: "Devolvida",
  APPROVED: "Aprovada",
  REJECTED: "Reprovada",
  CANCELLED: "Cancelada",
};

export const JOB_REQUEST_STATUS_COLORS: Record<JobRequestStatus, { bg: string; color: string }> = {
  SUBMITTED: { bg: "#FCF1DD", color: "#8A5B10" },
  IN_REVIEW: { bg: "#E9EDFA", color: "#3C56A8" },
  RETURNED: { bg: "#FDECEC", color: "#A24B2B" },
  APPROVED: { bg: "#EAF4DC", color: "#4F6930" },
  REJECTED: { bg: "#F4E3E3", color: "#9A3B3B" },
  CANCELLED: { bg: "#EFEFEF", color: "#6B7280" },
};

/** Requisições que ainda exigem ação do RH (badge do menu, KPI, dashboard). */
export const OPEN_JOB_REQUEST_STATUSES: JobRequestStatus[] = ["SUBMITTED", "IN_REVIEW"];

/** Requisições encerradas — ocultas por padrão na fila. */
export const CLOSED_JOB_REQUEST_STATUSES: JobRequestStatus[] = [
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

export function isOpenJobRequest(status: string): boolean {
  return (OPEN_JOB_REQUEST_STATUSES as string[]).includes(status);
}

/**
 * SLA interno de primeira resposta ao gestor (dias corridos).
 * Requisições paradas além disso ganham destaque visual na fila.
 */
export const JOB_REQUEST_SLA_DAYS = 2;

export function jobRequestAgeInDays(createdAt: string, now: Date = new Date()): number {
  const created = new Date(createdAt).getTime();
  return Math.floor((now.getTime() - created) / 86_400_000);
}
