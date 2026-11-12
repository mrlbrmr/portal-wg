// Estado de EXIBIÇÃO da solicitação de vaga. O workflow (workflow.ts) termina em RECRUITING:
// a partir daí quem anda é a vaga. Para a fila não acumular "Em recrutamento" para sempre,
// o desfecho é DERIVADO da vaga ligada — nada é gravado na solicitação:
//   • vaga encerrada (FILLED)  → "Atendida"
//   • vaga cancelada (CLOSED)  → "Encerrada sem contratação"
//   • vaga aberta/pausada/rascunho, ou sem vaga carregada → segue "Em recrutamento"
// Puro e testado (outcome.test.ts).

import { jobLifecycle } from "@/lib/recruitment/job-presentation";
import {
  JOB_REQUEST_STATUS_COLORS,
  JOB_REQUEST_STATUS_LABELS,
  JOB_REQUEST_STATUS_SHORT,
} from "./constants";
import type { JobRequestStatus } from "@/types/domain";

export type JobRequestOutcome = "FULFILLED" | "CLOSED_UNFILLED";
export type JobRequestDisplayStatus = JobRequestStatus | JobRequestOutcome;

export function requestDisplayStatus(
  status: JobRequestStatus,
  jobStatus: string | null | undefined
): JobRequestDisplayStatus {
  if (status !== "RECRUITING" || !jobStatus) return status;
  const lifecycle = jobLifecycle(jobStatus);
  if (lifecycle === "FILLED") return "FULFILLED";
  if (lifecycle === "CLOSED") return "CLOSED_UNFILLED";
  return status;
}

/** Desfechos (sem ação pendente para ninguém) — não aparecem como "em recrutamento". */
export function isConcludedRequest(display: JobRequestDisplayStatus): boolean {
  return display === "FULFILLED" || display === "CLOSED_UNFILLED" || display === "REJECTED" || display === "CANCELLED";
}

const OUTCOME_META: Record<JobRequestOutcome, { label: string; short: string; bg: string; color: string }> = {
  FULFILLED: { label: "Atendida — vaga encerrada", short: "Atendida", bg: "#EAF4DC", color: "#4F6930" },
  CLOSED_UNFILLED: {
    label: "Encerrada sem contratação — vaga cancelada",
    short: "Encerrada sem contratação",
    bg: "#EFEFEF",
    color: "#6B7280",
  },
};

export function displayStatusLabel(s: JobRequestDisplayStatus, variant: "short" | "full" = "short"): string {
  if (s === "FULFILLED" || s === "CLOSED_UNFILLED") return variant === "full" ? OUTCOME_META[s].label : OUTCOME_META[s].short;
  return (variant === "full" ? JOB_REQUEST_STATUS_LABELS[s] : JOB_REQUEST_STATUS_SHORT[s]) ?? s;
}

export function displayStatusColors(s: JobRequestDisplayStatus): { bg: string; color: string } {
  if (s === "FULFILLED" || s === "CLOSED_UNFILLED") return { bg: OUTCOME_META[s].bg, color: OUTCOME_META[s].color };
  return JOB_REQUEST_STATUS_COLORS[s] ?? { bg: "#EFEFEF", color: "#6B7280" };
}
