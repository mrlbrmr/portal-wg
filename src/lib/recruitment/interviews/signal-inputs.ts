// Entradas do sinal de entrevista do card do pipeline. Puro: sem banco, sem React.

import type { InterviewStatus } from "./catalog";

export interface AgendaRow {
  round: string;
  scheduledAt: string;
  durationMin: number;
  status: InterviewStatus;
}

/**
 * Caminho antigo (parecer com data) só vale para quem NUNCA teve linha na agenda (qualquer status);
 * o card recebe apenas as linhas SCHEDULED.
 */
export function agendaSignalInputs(
  rawInterviews: AgendaRow[] | null | undefined,
  legacyNextInterviewAt: string | null,
): { nextInterviewAt: string | null; interviews: AgendaRow[] } {
  const rows = rawInterviews ?? [];
  return {
    nextInterviewAt: rows.length ? null : legacyNextInterviewAt,
    interviews: rows.filter((i) => i.status === "SCHEDULED"),
  };
}
