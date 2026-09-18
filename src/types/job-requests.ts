import type {
  ApprovalStepStatus,
  BudgetStatus,
  ContractType,
  JobRequestReason,
  JobRequestStatus,
  Modality,
} from "@/types/domain";

/**
 * SOLICITAÇÃO DE VAGA — o pedido de autorização para contratar.
 *
 * Não é uma vaga: só vira `Job` (processo seletivo) por uma ação explícita do RH, depois
 * de aprovada. Ver src/lib/job-requests/workflow.ts para as regras de transição.
 *
 * Forma serializável (datas em ISO string) para cruzar o limite server → client.
 */
export interface JobRequestRow {
  id: string;
  /** Identificador humano: REQ-2026-0042. */
  code: string | null;

  status: JobRequestStatus;

  // ── Dados da solicitação ──
  title: string | null;
  department: string | null;
  /** Empresa / Unidade. */
  location: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  requestedByUserId: string | null;
  openings: number | null;

  // ── Motivo da contratação ──
  reasonType: JobRequestReason;
  replacedEmployee: string | null;
  justification: string | null;
  desiredStartDate: string | null; // ISO date

  // ── Condições da vaga ──
  contractType: ContractType | null;
  modality: Modality | null;
  workSchedule: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  costCenter: string | null;
  budgetStatus: BudgetStatus;

  // ── Aprovação ──
  submittedAt: string | null;
  hrValidatedAt: string | null;
  hrValidatedBy: string | null;
  currentApproverUserId: string | null;
  currentApproverName: string | null;
  approvedAt: string | null;
  approvedByName: string | null;

  /** Última decisão registrada (parecer exibido no topo e enviado por e-mail). */
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;

  // ── Processo seletivo gerado ──
  jobId: string | null;
  jobCode: string | null;
  jobTitle: string | null;
  jobStatus: string | null;

  /** Respostas das perguntas complementares configuráveis. */
  extraData: Record<string, string>;

  createdAt: string;
  updatedAt: string;
}

/** Um evento da timeline da solicitação. */
export interface JobRequestHistoryRow {
  id: string;
  event: string;
  fromStatus: string | null;
  toStatus: string | null;
  comment: string | null;
  actorName: string | null;
  createdAt: string;
}

/** Um passo da cadeia de aprovação. */
export interface JobRequestApprovalRow {
  id: string;
  stepOrder: number;
  ruleKey: string | null;
  approverUserId: string | null;
  approverName: string | null;
  status: ApprovalStepStatus;
  comment: string | null;
  decidedAt: string | null;
}

/** Estado dos filtros da listagem de solicitações. "" = sem filtro. */
export interface JobRequestFilters {
  status: string;
  requester: string;
  location: string;
  department: string;
  reason: string;
  from: string; // ISO date
  to: string; // ISO date
}

export const EMPTY_JOB_REQUEST_FILTERS: JobRequestFilters = {
  status: "",
  requester: "",
  location: "",
  department: "",
  reason: "",
  from: "",
  to: "",
};

// Reexportados para quem só precisa dos rótulos/cores (a fonte é o módulo de constantes).
export {
  CLOSED_JOB_REQUEST_STATUSES,
  JOB_REQUEST_SLA_DAYS,
  JOB_REQUEST_STATUS_COLORS,
  JOB_REQUEST_STATUS_LABELS,
  OPEN_JOB_REQUEST_STATUSES,
  isOpenJobRequest,
  jobRequestAgeInDays,
} from "@/lib/job-requests/constants";
