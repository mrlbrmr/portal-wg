// Máquina de estados da solicitação de vaga — módulo PURO (sem banco, sem sessão).
//
// É aqui que mora a regra: de qual status para qual, quem pode, quando o comentário é
// obrigatório e o que conta como "campo crítico". O service (server) e a UI (client)
// consultam este mesmo módulo, então o botão que aparece na tela é exatamente a ação que
// o servidor vai aceitar — e é isto que os testes exercitam.
//
// Nada de dropdown livre de status: a UI só oferece `availableActions()`.

import type { JobRequestStatus } from "@/types/domain";

// ─── Quem está agindo ─────────────────────────────────────────────────────────

export interface WorkflowActor {
  /** users.id (claim app_metadata.app_user_id). Null = anônimo / formulário público. */
  userId: string | null;
  name: string;
  /** UserRole do sistema: ADMIN_RH escreve, VIEWER_RH só lê. */
  role: string;
  /** Flag users.isApprover — permite decidir mesmo sendo VIEWER_RH. */
  isApprover: boolean;
}

/** O mínimo que o workflow precisa saber sobre a solicitação. */
export interface WorkflowRequest {
  status: JobRequestStatus;
  requestedByUserId: string | null;
  currentApproverUserId: string | null;
  jobId: string | null;
}

export type ActorCapability = "ADMIN" | "HR" | "REQUESTER" | "APPROVER";

export function isAdmin(actor: WorkflowActor): boolean {
  return actor.role === "ADMIN_RH";
}

/** RH = quem escreve no painel. Hoje isso é exatamente ADMIN_RH (VIEWER_RH só lê). */
export function isHR(actor: WorkflowActor): boolean {
  return isAdmin(actor);
}

export function isRequester(req: WorkflowRequest, actor: WorkflowActor): boolean {
  return Boolean(actor.userId) && req.requestedByUserId === actor.userId;
}

/** Aprovador da vez. O ADMIN pode tudo (regra 14: "ADMIN pode realizar todas as operações"). */
export function isCurrentApprover(req: WorkflowRequest, actor: WorkflowActor): boolean {
  return Boolean(actor.userId) && req.currentApproverUserId === actor.userId;
}

function has(req: WorkflowRequest, actor: WorkflowActor, cap: ActorCapability): boolean {
  if (isAdmin(actor)) return true;
  switch (cap) {
    case "ADMIN":
      return false;
    case "HR":
      return isHR(actor);
    case "REQUESTER":
      return isRequester(req, actor);
    case "APPROVER":
      return isCurrentApprover(req, actor) && actor.isApprover;
  }
}

// ─── Ações do workflow ────────────────────────────────────────────────────────

export type WorkflowActionId =
  | "SUBMIT"
  | "HR_VALIDATE"
  | "HR_RETURN"
  | "APPROVE"
  | "REJECT"
  | "APPROVER_RETURN"
  | "CANCEL"
  | "START_RECRUITMENT"
  | "REOPEN";

export interface WorkflowAction {
  id: WorkflowActionId;
  label: string;
  /** Status resultante. START_RECRUITMENT também cria a vaga (função no banco). */
  to: JobRequestStatus;
  from: JobRequestStatus[];
  /** Quem pode disparar (além do ADMIN, que pode sempre). */
  by: ActorCapability[];
  /** Comentário obrigatório? (devolver / reprovar / cancelar) */
  requiresComment: boolean;
  /** Pede confirmação na UI por ser destrutiva ou definitiva. */
  confirm: boolean;
  /** Peso visual do botão na tela da solicitação. */
  tone: "primary" | "neutral" | "warning" | "danger";
}

export const WORKFLOW_ACTIONS: Record<WorkflowActionId, WorkflowAction> = {
  SUBMIT: {
    id: "SUBMIT",
    label: "Enviar para validação do RH",
    to: "PENDING_HR",
    from: ["DRAFT", "RETURNED"],
    by: ["REQUESTER", "HR"],
    requiresComment: false,
    confirm: false,
    tone: "primary",
  },
  HR_VALIDATE: {
    id: "HR_VALIDATE",
    label: "Validar e encaminhar para aprovação",
    to: "PENDING_APPROVAL",
    from: ["PENDING_HR"],
    by: ["HR"],
    requiresComment: false,
    confirm: false,
    tone: "primary",
  },
  HR_RETURN: {
    id: "HR_RETURN",
    label: "Devolver ao gestor",
    to: "RETURNED",
    from: ["PENDING_HR"],
    by: ["HR"],
    requiresComment: true,
    confirm: false,
    tone: "warning",
  },
  APPROVE: {
    id: "APPROVE",
    label: "Aprovar",
    to: "APPROVED",
    from: ["PENDING_APPROVAL"],
    by: ["APPROVER"],
    requiresComment: false,
    confirm: false,
    tone: "primary",
  },
  APPROVER_RETURN: {
    id: "APPROVER_RETURN",
    label: "Devolver para ajuste",
    to: "RETURNED",
    from: ["PENDING_APPROVAL"],
    by: ["APPROVER"],
    requiresComment: true,
    confirm: false,
    tone: "warning",
  },
  REJECT: {
    id: "REJECT",
    label: "Reprovar",
    to: "REJECTED",
    from: ["PENDING_APPROVAL"],
    by: ["APPROVER"],
    requiresComment: true,
    confirm: true,
    tone: "danger",
  },
  CANCEL: {
    id: "CANCEL",
    label: "Cancelar solicitação",
    to: "CANCELLED",
    from: ["DRAFT", "PENDING_HR", "PENDING_APPROVAL", "APPROVED", "RETURNED"],
    by: ["REQUESTER", "HR"],
    requiresComment: true,
    confirm: true,
    tone: "danger",
  },
  START_RECRUITMENT: {
    id: "START_RECRUITMENT",
    label: "Criar processo seletivo",
    to: "RECRUITING",
    from: ["APPROVED"],
    by: ["HR"],
    requiresComment: false,
    confirm: false,
    tone: "primary",
  },
  REOPEN: {
    id: "REOPEN",
    label: "Reabrir solicitação",
    to: "PENDING_HR",
    from: ["REJECTED", "CANCELLED"],
    by: ["HR"],
    requiresComment: false,
    confirm: false,
    tone: "neutral",
  },
};

export type WorkflowDenial =
  | { ok: true }
  | { ok: false; reason: "STATUS" | "PERMISSION" | "COMMENT" | "ALREADY_RECRUITING"; message: string };

/**
 * Único ponto de decisão do workflow. O service chama antes de escrever; a UI chama para
 * saber quais botões mostrar. Mesmas respostas nos dois lados.
 */
export function canRunAction(
  actionId: WorkflowActionId,
  req: WorkflowRequest,
  actor: WorkflowActor,
  comment?: string | null,
  /** `ignoreComment` serve para a UI decidir quais botões mostrar antes de digitar nada. */
  opts?: { ignoreComment?: boolean }
): WorkflowDenial {
  const action = WORKFLOW_ACTIONS[actionId];
  if (!action) {
    return { ok: false, reason: "STATUS", message: "Ação desconhecida." };
  }

  if (!action.from.includes(req.status)) {
    return {
      ok: false,
      reason: "STATUS",
      message: `Esta ação não é válida para uma solicitação com o status atual.`,
    };
  }

  // Regra 15: uma solicitação que já virou vaga não pode gerar outra.
  if (actionId === "START_RECRUITMENT" && req.jobId) {
    return {
      ok: false,
      reason: "ALREADY_RECRUITING",
      message: "Esta solicitação já tem um processo seletivo. Não é possível criar outro.",
    };
  }

  if (!action.by.some((cap) => has(req, actor, cap))) {
    return {
      ok: false,
      reason: "PERMISSION",
      message: "Você não tem permissão para executar esta ação.",
    };
  }

  if (action.requiresComment && !opts?.ignoreComment && !(comment ?? "").trim()) {
    return {
      ok: false,
      reason: "COMMENT",
      message: "Descreva o motivo — o comentário é obrigatório nesta ação.",
    };
  }

  return { ok: true };
}

/** Ações que a UI deve oferecer. A lista de comentário obrigatório vem junto. */
export function availableActions(
  req: WorkflowRequest,
  actor: WorkflowActor
): WorkflowAction[] {
  return (Object.keys(WORKFLOW_ACTIONS) as WorkflowActionId[])
    .map((id) => WORKFLOW_ACTIONS[id])
    .filter((a) => canRunAction(a.id, req, actor, null, { ignoreComment: true }).ok);
}

// ─── Edição ───────────────────────────────────────────────────────────────────

/**
 * Campos críticos: alterá-los depois de aprovado invalida a aprovação (regra 9).
 *
 * Faixa salarial, centro de custo e previsão de orçamento ficaram de fora porque a
 * solicitação não os coleta (ver o comentário em schema.ts).
 */
export const CRITICAL_FIELDS = [
  "title",
  "openings",
  "location",
  "contractType",
  "reasonType",
] as const;
export type CriticalField = (typeof CRITICAL_FIELDS)[number];

export const CRITICAL_FIELD_LABELS: Record<CriticalField, string> = {
  title: "Título da vaga",
  openings: "Número de posições",
  location: "Empresa / Unidade",
  contractType: "Tipo de contratação",
  reasonType: "Motivo da abertura",
};

/** Status em que a aprovação já foi dada (ou está em curso) e precisa ser protegida. */
const APPROVAL_SENSITIVE_STATUSES: JobRequestStatus[] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "RECRUITING",
];

function normalize(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

/** Quais campos críticos mudaram entre o que está salvo e o que está sendo enviado. */
export function findCriticalChanges(
  before: Partial<Record<CriticalField, unknown>>,
  after: Partial<Record<CriticalField, unknown>>
): CriticalField[] {
  return CRITICAL_FIELDS.filter((field) => {
    if (!(field in after)) return false;
    return normalize(before[field]) !== normalize(after[field]);
  });
}

export type EditDecision =
  | { allowed: false; message: string }
  | { allowed: true; requiresReapproval: false }
  | { allowed: true; requiresReapproval: true; changed: CriticalField[]; warning: string };

export const REAPPROVAL_WARNING =
  "Esta alteração modifica dados que já foram aprovados e exigirá uma nova aprovação.";

/**
 * Pode editar? E essa edição derruba a aprovação?
 *
 * Regra 9: mexer em campo crítico depois da aprovação joga a solicitação de volta para
 * "Aguardando aprovação" e trava o início do recrutamento. Campos operacionais (justificativa,
 * horário, data desejada...) não disparam nada.
 */
export function evaluateEdit(
  req: WorkflowRequest,
  actor: WorkflowActor,
  changedCritical: CriticalField[]
): EditDecision {
  const admin = isAdmin(actor);

  if (req.status === "REJECTED" || req.status === "CANCELLED") {
    return {
      allowed: false,
      message: "Solicitações reprovadas ou canceladas não podem ser editadas. Reabra antes.",
    };
  }

  if (req.status === "DRAFT" || req.status === "RETURNED") {
    // Devolvida volta para a mão do solicitante — é justamente o ponto do fluxo.
    if (!admin && !isRequester(req, actor)) {
      return { allowed: false, message: "Só o solicitante ou o RH podem editar esta solicitação." };
    }
    return { allowed: true, requiresReapproval: false };
  }

  // A partir daqui a solicitação já saiu da mão do gestor: só o RH mexe.
  if (!isHR(actor)) {
    return {
      allowed: false,
      message: "Esta solicitação já está em análise. Fale com o RH para alterar os dados.",
    };
  }

  if (req.status === "RECRUITING" && changedCritical.length > 0) {
    return {
      allowed: false,
      message:
        "O processo seletivo já foi criado. Dados aprovados não podem mais ser alterados aqui — " +
        "cancele a solicitação e abra uma nova, ou ajuste a vaga diretamente.",
    };
  }

  if (APPROVAL_SENSITIVE_STATUSES.includes(req.status) && changedCritical.length > 0) {
    return {
      allowed: true,
      requiresReapproval: true,
      changed: changedCritical,
      warning: REAPPROVAL_WARNING,
    };
  }

  return { allowed: true, requiresReapproval: false };
}

/** Status para o qual a solicitação volta quando a aprovação é invalidada. */
export const REAPPROVAL_STATUS: JobRequestStatus = "PENDING_APPROVAL";

/** Regra 15: só uma solicitação aprovada (e sem vaga) pode iniciar recrutamento. */
export function canStartRecruitment(req: WorkflowRequest, actor: WorkflowActor): WorkflowDenial {
  return canRunAction("START_RECRUITMENT", req, actor);
}

// ─── Cadeia de aprovação (base extensível — regra 7) ──────────────────────────

export interface ApprovalStepPlan {
  stepOrder: number;
  ruleKey: string;
  /** Null = o RH escolhe o aprovador ao encaminhar. */
  approverUserId: string | null;
}

export interface ApprovalContext {
  reasonType: string;
}

/**
 * Monta a cadeia de aprovação de uma solicitação.
 *
 * V1: um passo só — o aprovador que o RH indicar ao encaminhar. A assinatura já recebe o
 * contexto (motivo, orçamento) e devolve uma LISTA ordenada, então evoluir para "aumento
 * de quadro passa por Diretoria + Financeiro" é acrescentar regras aqui — sem tocar em
 * schema, service ou UI.
 */
export function buildApprovalChain(
  ctx: ApprovalContext,
  primaryApproverUserId: string | null
): ApprovalStepPlan[] {
  const steps: ApprovalStepPlan[] = [
    { stepOrder: 1, ruleKey: "DEFAULT", approverUserId: primaryApproverUserId },
  ];

  // Ganchos já previstos (desligados na V1 — nenhum passo extra é criado ainda):
  //   ctx.reasonType === "HEADCOUNT_INCREASE" → passo "BUDGET" (Financeiro/Diretoria)
  void ctx;

  return steps;
}
