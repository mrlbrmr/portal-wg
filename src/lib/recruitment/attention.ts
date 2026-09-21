// Motivos de atenção de uma vaga — regra pura, compartilhada por Dashboard e lista de Vagas.
//
// Princípio: nunca sinalizar uma vaga sem dizer POR QUÊ. Cada motivo tem texto próprio
// ("Sem movimentação há 32 dias") e um tom semântico. A situação operacional da vaga
// (Normal / Atenção / Atrasada) é o pior tom entre os motivos.

import { STALE_JOB_DAYS, pluralDays } from "@/lib/utils";
import type { Tone } from "@/components/ui/StatusBadge";
import { jobLifecycle } from "@/lib/recruitment/job-presentation";
import { evaluateSla, SLA_META, type SlaPolicy, RECRUITMENT_SLA_POLICY } from "@/lib/recruitment/sla";

/**
 * Limiares usados pelos alertas. Centralizados aqui para virarem configuração quando o RH
 * definir seus números. `staleDays` reaproveita a regra que já existia no Kanban;
 * `closingSoonDays` é a janela que o Dashboard já usava para "vagas encerrando".
 * `noCandidatesDays` é o único valor novo (provisório) — ajuste se o RH preferir outro.
 */
export const ATTENTION_RULES = {
  staleDays: STALE_JOB_DAYS,
  closingSoonDays: 7,
  noCandidatesDays: 7,
} as const;

export type AttentionKey = "NEW_CANDIDATES" | "CLOSING_SOON" | "CLOSING_PASSED" | "NO_CANDIDATES" | "STALE" | "SLA";

export interface AttentionReason {
  key: AttentionKey;
  label: string;
  tone: Extract<Tone, "warning" | "danger">;
}

export type OperationalSituation = "NORMAL" | "ATTENTION" | "LATE";

export const SITUATION_META: Record<OperationalSituation, { label: string; tone: Tone }> = {
  NORMAL: { label: "Normal", tone: "success" },
  ATTENTION: { label: "Atenção", tone: "warning" },
  LATE: { label: "Atrasada", tone: "danger" },
};

export interface AttentionInput {
  status: string;
  /** Quando a vaga foi aberta (primeira publicação) — ISO. */
  openedAt: string;
  lastActivityAt: string;
  candidateCount: number;
  /** Candidaturas na etapa "Novo" (aguardando triagem). */
  newCount: number;
  closingDate?: string | null;
}

const DAY = 86_400_000;

function wholeDays(fromIso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY));
}

export function jobAttentionReasons(
  job: AttentionInput,
  now: Date = new Date(),
  slaPolicy: SlaPolicy | null = RECRUITMENT_SLA_POLICY
): AttentionReason[] {
  // Só vagas abertas pedem ação de recrutamento.
  if (jobLifecycle(job.status) !== "OPEN") return [];

  const reasons: AttentionReason[] = [];
  const openDays = wholeDays(job.openedAt, now);

  if (job.newCount > 0) {
    reasons.push({
      key: "NEW_CANDIDATES",
      label:
        job.newCount === 1 ? "1 candidato aguardando triagem" : `${job.newCount} candidatos aguardando triagem`,
      tone: "warning",
    });
  }

  if (job.closingDate) {
    const msLeft = new Date(job.closingDate).getTime() - now.getTime();
    if (msLeft < 0) {
      const d = Math.max(1, Math.floor(-msLeft / DAY));
      reasons.push({ key: "CLOSING_PASSED", label: `Prazo de inscrição vencido há ${pluralDays(d)}`, tone: "danger" });
    } else if (msLeft <= ATTENTION_RULES.closingSoonDays * DAY) {
      const d = Math.floor(msLeft / DAY);
      reasons.push({
        key: "CLOSING_SOON",
        label: d === 0 ? "Inscrições encerram hoje" : `Inscrições encerram em ${pluralDays(d)}`,
        tone: "warning",
      });
    }
  }

  if (job.candidateCount === 0 && openDays >= ATTENTION_RULES.noCandidatesDays) {
    reasons.push({ key: "NO_CANDIDATES", label: `Nenhum candidato em ${pluralDays(openDays)}`, tone: "warning" });
  }

  const idleDays = wholeDays(job.lastActivityAt, now);
  if (idleDays >= ATTENTION_RULES.staleDays) {
    reasons.push({ key: "STALE", label: `Sem movimentação há ${pluralDays(idleDays)}`, tone: "danger" });
  }

  const sla = evaluateSla(openDays, slaPolicy);
  if (sla && sla.state !== "ON_TRACK") {
    reasons.push({
      key: "SLA",
      label: sla.state === "BREACHED" ? `SLA excedido em ${pluralDays(sla.overByDays)}` : `${SLA_META.AT_RISK.label}: SLA vence em ${pluralDays(sla.remainingDays)}`,
      tone: sla.state === "BREACHED" ? "danger" : "warning",
    });
  }

  return reasons;
}

export function operationalSituation(reasons: AttentionReason[]): OperationalSituation {
  if (reasons.some((r) => r.tone === "danger")) return "LATE";
  if (reasons.length > 0) return "ATTENTION";
  return "NORMAL";
}

/** Ordenação por urgência: atrasadas primeiro, depois mais motivos. */
export function attentionScore(reasons: AttentionReason[]): number {
  return reasons.reduce((acc, r) => acc + (r.tone === "danger" ? 10 : 1), 0);
}
