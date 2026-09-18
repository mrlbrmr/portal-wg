// Vocabulário da SOLICITAÇÃO DE VAGA (o pedido de autorização para contratar).
//
// Fonte única dos rótulos, cores e listas de status/motivo/orçamento. Nada de string solta
// espalhada por página ou componente: quem precisa exibir um status importa daqui.
// As cores reaproveitam os tokens já usados no painel (mesma paleta dos badges do Kanban).

import type {
  BudgetStatus,
  ContractType,
  JobRequestReason,
  JobRequestStatus,
  Modality,
} from "@/types/domain";

// ─── Status ───────────────────────────────────────────────────────────────────

export const JOB_REQUEST_STATUS_ORDER: JobRequestStatus[] = [
  "DRAFT",
  "PENDING_HR",
  "PENDING_APPROVAL",
  "APPROVED",
  "RECRUITING",
  "RETURNED",
  "REJECTED",
  "CANCELLED",
];

export const JOB_REQUEST_STATUS_LABELS: Record<JobRequestStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_HR: "Aguardando validação do RH",
  PENDING_APPROVAL: "Aguardando aprovação",
  APPROVED: "Aprovada",
  RETURNED: "Devolvida para ajuste",
  REJECTED: "Reprovada",
  CANCELLED: "Cancelada",
  RECRUITING: "Recrutamento iniciado",
};

/** Versão curta para tabelas e chips estreitos. */
export const JOB_REQUEST_STATUS_SHORT: Record<JobRequestStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_HR: "Aguardando RH",
  PENDING_APPROVAL: "Aguardando aprovação",
  APPROVED: "Aprovada",
  RETURNED: "Devolvida",
  REJECTED: "Reprovada",
  CANCELLED: "Cancelada",
  RECRUITING: "Em recrutamento",
};

export const JOB_REQUEST_STATUS_COLORS: Record<
  JobRequestStatus,
  { bg: string; color: string }
> = {
  DRAFT:            { bg: "#EFEFEF", color: "#6B7280" }, // cinza
  PENDING_HR:       { bg: "#E9EDFA", color: "#3C56A8" }, // azul
  PENDING_APPROVAL: { bg: "#FCF1DD", color: "#8A5B10" }, // amarelo
  APPROVED:         { bg: "#EAF4DC", color: "#4F6930" }, // verde
  RETURNED:         { bg: "#FDECEC", color: "#A24B2B" }, // laranja
  REJECTED:         { bg: "#F4E3E3", color: "#9A3B3B" }, // vermelho
  CANCELLED:        { bg: "#EFEFEF", color: "#9A3B3B" }, // cinza/vermelho
  RECRUITING:       { bg: "#E2F0E4", color: "#2F6B4F" }, // verde/azul
};

/** Solicitações que ainda dependem de alguém (badge do menu, KPI, dashboard). */
export const OPEN_JOB_REQUEST_STATUSES: JobRequestStatus[] = [
  "PENDING_HR",
  "PENDING_APPROVAL",
];

/** Já encerradas — nenhuma ação de workflow pendente. */
export const CLOSED_JOB_REQUEST_STATUSES: JobRequestStatus[] = [
  "RECRUITING",
  "REJECTED",
  "CANCELLED",
];

export function isOpenJobRequest(status: string): boolean {
  return (OPEN_JOB_REQUEST_STATUSES as string[]).includes(status);
}

/** SLA interno de primeira resposta ao gestor (dias corridos). */
export const JOB_REQUEST_SLA_DAYS = 2;

export function jobRequestAgeInDays(createdAt: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000);
}

// ─── Motivo da abertura ───────────────────────────────────────────────────────

export const JOB_REQUEST_REASON_LABELS: Record<JobRequestReason, string> = {
  REPLACEMENT: "Substituição",
  HEADCOUNT_INCREASE: "Aumento de quadro",
  NEW_POSITION: "Nova posição",
  TEMPORARY: "Temporária",
  OTHER: "Outro",
};

export const JOB_REQUEST_REASON_ORDER: JobRequestReason[] = [
  "REPLACEMENT",
  "HEADCOUNT_INCREASE",
  "NEW_POSITION",
  "TEMPORARY",
  "OTHER",
];

/** Motivos que exigem informar o colaborador substituído. */
export function requiresReplacedEmployee(reason: JobRequestReason): boolean {
  return reason === "REPLACEMENT";
}

// ─── Orçamento / headcount ────────────────────────────────────────────────────

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  YES: "Sim, prevista no orçamento",
  NO: "Não prevista",
  NOT_APPLICABLE: "Não informado / não se aplica",
};

export const BUDGET_STATUS_ORDER: BudgetStatus[] = ["YES", "NO", "NOT_APPLICABLE"];

// ─── Condições da vaga (reaproveita os enums que a vaga já usa) ───────────────

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  CLT: "CLT",
  PJ: "PJ",
  INTERNSHIP: "Estágio",
  APPRENTICE: "Jovem Aprendiz",
  TEMPORARY: "Temporário",
  OTHER: "Outro",
};

export const CONTRACT_TYPE_ORDER: ContractType[] = [
  "CLT",
  "INTERNSHIP",
  "APPRENTICE",
  "TEMPORARY",
  "PJ",
  "OTHER",
];

export const MODALITY_LABELS: Record<Modality, string> = {
  PRESENTIAL: "Presencial",
  HYBRID: "Híbrido",
  REMOTE: "Remoto",
};

export const MODALITY_ORDER: Modality[] = ["PRESENTIAL", "HYBRID", "REMOTE"];

// ─── Eventos do histórico ─────────────────────────────────────────────────────

export const HISTORY_EVENT_LABELS: Record<string, string> = {
  CREATED: "Solicitação criada",
  UPDATED: "Solicitação editada",
  SUBMITTED: "Enviada para validação do RH",
  HR_VALIDATED: "Validada pelo RH e encaminhada para aprovação",
  HR_RETURNED: "Devolvida pelo RH para ajuste",
  APPROVED: "Solicitação aprovada",
  REJECTED: "Solicitação reprovada",
  APPROVER_RETURNED: "Devolvida pelo aprovador para ajuste",
  CANCELLED: "Solicitação cancelada",
  REOPENED: "Solicitação reaberta",
  REAPPROVAL_REQUIRED: "Dados aprovados foram alterados — nova aprovação exigida",
  RECRUITMENT_STARTED: "Processo seletivo criado",
};

export function historyEventLabel(event: string): string {
  return HISTORY_EVENT_LABELS[event] ?? event;
}
