// Posições da vaga — módulo PURO (sem banco, sem sessão).
//
//   Vaga (processo seletivo) ──► Posições #01, #02… ──► quem foi contratado em cada uma
//
// A vaga é UM processo seletivo (uma descrição, um pipeline, um conjunto de candidatos);
// as posições são as contratações que esse processo precisa entregar. A regra de verdade
// (travas, "não preencher duas vezes", "não zerar posições") mora nas funções do banco
// (supabase/migrations/20260923200000_job_positions.sql). Aqui ficam o resumo, os rótulos
// e as MESMAS regras em forma de "posso?" — para a UI só oferecer o que o banco aceita.

import type { Tone } from "@/components/ui/StatusBadge";

export type PositionStatus = "OPEN" | "FILLED" | "CANCELLED";

export interface JobPosition {
  id: string;
  positionNumber: number;
  status: PositionStatus;
  applicationId: string | null;
  admissionId: string | null;
  candidateName: string | null;
  expectedStartDate: string | null;
  filledAt: string | null;
  filledBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
}

export const POSITION_STATUS_META: Record<PositionStatus, { label: string; tone: Tone }> = {
  OPEN: { label: "Em aberto", tone: "warning" },
  FILLED: { label: "Preenchida", tone: "success" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
};

/** "#01", "#02"… — identificação amigável da posição. */
export function positionLabel(n: number): string {
  return `#${String(n).padStart(2, "0")}`;
}

/** Estado operacional DERIVADO das posições (não é status gravado da vaga). */
export type FillState = "NO_POSITIONS" | "OPEN" | "PARTIAL" | "ALL_FILLED";

export interface PositionsSummary {
  /** Posições ativas (em aberto + preenchidas). Canceladas não contam. */
  total: number;
  filled: number;
  open: number;
  cancelled: number;
  state: FillState;
  /** 0–100 */
  percent: number;
}

export function summarizePositions(positions: Pick<JobPosition, "status">[]): PositionsSummary {
  let filled = 0;
  let open = 0;
  let cancelled = 0;
  for (const p of positions) {
    if (p.status === "FILLED") filled++;
    else if (p.status === "OPEN") open++;
    else cancelled++;
  }
  const total = filled + open;
  const state: FillState =
    total === 0 ? "NO_POSITIONS" : filled === 0 ? "OPEN" : filled < total ? "PARTIAL" : "ALL_FILLED";
  return { total, filled, open, cancelled, state, percent: total ? (filled / total) * 100 : 0 };
}

export const FILL_STATE_META: Record<FillState, { label: string; tone: Tone }> = {
  NO_POSITIONS: { label: "Sem posições", tone: "neutral" },
  OPEN: { label: "Em aberto", tone: "warning" },
  PARTIAL: { label: "Parcialmente preenchida", tone: "info" },
  ALL_FILLED: { label: "Todas as posições preenchidas", tone: "success" },
};

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "1 de 2 posições preenchidas" */
export function progressLabel(s: Pick<PositionsSummary, "filled" | "total">): string {
  return `${s.filled} de ${plural(s.total, "posição preenchida", "posições preenchidas")}`;
}

/** "1 posição restante" · "Todas as posições preenchidas" */
export function remainingLabel(s: Pick<PositionsSummary, "open" | "total">): string {
  if (s.total === 0) return "Nenhuma posição ativa";
  if (s.open === 0) return "Todas as posições preenchidas";
  return plural(s.open, "posição restante", "posições restantes");
}

// ─── Regras (espelho das funções do banco) ──────────────────────────────────────────────

export type Check = { ok: true } | { ok: false; reason: string };

const OK: Check = { ok: true };

export function canAddPosition(job: { isTalentPool: boolean }): Check {
  return job.isTalentPool ? { ok: false, reason: "Banco de talentos não tem posições." } : OK;
}

export function canCancelPosition(
  position: Pick<JobPosition, "status" | "positionNumber">,
  all: Pick<JobPosition, "status">[]
): Check {
  if (position.status === "FILLED") {
    return {
      ok: false,
      reason: `A posição ${positionLabel(position.positionNumber)} está preenchida. Libere a contratação antes de cancelar.`,
    };
  }
  if (position.status === "CANCELLED") return { ok: false, reason: "A posição já está cancelada." };
  if (summarizePositions(all).total <= 1) {
    return {
      ok: false,
      reason: "Uma vaga específica precisa de ao menos 1 posição. Para desistir do processo, cancele a vaga.",
    };
  }
  return OK;
}

export function canFillPosition(
  position: Pick<JobPosition, "status">,
  applicationId: string,
  all: Pick<JobPosition, "status" | "applicationId" | "positionNumber">[]
): Check {
  if (position.status !== "OPEN") return { ok: false, reason: "Só uma posição em aberto pode receber um contratado." };
  const other = all.find((p) => p.status === "FILLED" && p.applicationId === applicationId);
  if (other) return { ok: false, reason: `Este candidato já ocupa a posição ${positionLabel(other.positionNumber)}.` };
  return OK;
}

export function canReleasePosition(position: Pick<JobPosition, "status">): Check {
  return position.status === "FILLED" ? OK : { ok: false, reason: "Só uma posição preenchida pode ser liberada." };
}

/** Candidaturas que já ocupam alguma posição da vaga (não podem ocupar outra). */
export function occupiedApplicationIds(positions: Pick<JobPosition, "status" | "applicationId">[]): Set<string> {
  return new Set(
    positions.filter((p) => p.status === "FILLED" && p.applicationId).map((p) => p.applicationId as string)
  );
}

/** Ordem de exibição: ativas por número; canceladas por último. */
export function sortPositions<T extends Pick<JobPosition, "status" | "positionNumber">>(positions: T[]): T[] {
  return [...positions].sort((a, b) => {
    const ca = a.status === "CANCELLED" ? 1 : 0;
    const cb = b.status === "CANCELLED" ? 1 : 0;
    return ca - cb || a.positionNumber - b.positionNumber;
  });
}

/**
 * Oferecer o encerramento da vaga? Só quando TODAS as posições ativas foram preenchidas e
 * a vaga ainda está no ar. O sistema nunca encerra sozinho — o RH confirma.
 */
export function shouldOfferClosing(summary: PositionsSummary, isPublic: boolean): boolean {
  return summary.state === "ALL_FILLED" && isPublic;
}
