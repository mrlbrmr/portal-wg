// SLA de recrutamento — arquitetura pronta, SEM valores inventados.
//
// Hoje o sistema não tem uma regra de SLA para vagas (só existe JOB_REQUEST_SLA_DAYS, que
// é o prazo de primeira resposta a uma SOLICITAÇÃO, outra coisa). Por isso a política
// ativa é `null`: a UI mostra a idade da vaga ("Aberta há 17 dias") mas não classifica
// "No prazo / Atenção / SLA excedido".
//
// Para ligar o SLA: definir RECRUITMENT_SLA_POLICY (ou carregá-la de uma tabela de
// configuração) — nenhuma tela precisa mudar. Métricas futuras (time to fill, time to
// hire, tempo por etapa) devem nascer aqui, a partir de job_status_history e
// application_stage_history, que já registram as transições com data.

import type { Tone } from "@/components/ui/StatusBadge";

export interface SlaPolicy {
  /** Dias corridos para preencher a vaga a partir da abertura. */
  targetDays: number;
  /** A partir de quantos dias a vaga entra em "Atenção" (antes de estourar). */
  warningDays: number;
}

/** Política vigente. `null` = SLA ainda não definido pelo RH. */
export const RECRUITMENT_SLA_POLICY: SlaPolicy | null = null;

export type SlaState = "ON_TRACK" | "AT_RISK" | "BREACHED";

export interface SlaEvaluation {
  state: SlaState;
  /** Dias além do prazo (só em BREACHED). */
  overByDays: number;
  /** Dias restantes até o prazo (só em ON_TRACK / AT_RISK). */
  remainingDays: number;
}

export const SLA_META: Record<SlaState, { label: string; tone: Tone }> = {
  ON_TRACK: { label: "No prazo", tone: "success" },
  AT_RISK: { label: "Atenção", tone: "warning" },
  BREACHED: { label: "SLA excedido", tone: "danger" },
};

export function evaluateSla(ageDays: number, policy: SlaPolicy | null = RECRUITMENT_SLA_POLICY): SlaEvaluation | null {
  if (!policy) return null;
  if (ageDays > policy.targetDays) {
    return { state: "BREACHED", overByDays: ageDays - policy.targetDays, remainingDays: 0 };
  }
  const remainingDays = policy.targetDays - ageDays;
  return { state: ageDays >= policy.warningDays ? "AT_RISK" : "ON_TRACK", overByDays: 0, remainingDays };
}
