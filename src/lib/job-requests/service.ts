// Use cases da SOLICITAÇÃO DE VAGA.
//
// Toda a lógica de negócio mora aqui — as server actions (actions.ts) e a API só traduzem
// entrada/saída. Cada use case segue a mesma sequência:
//   1. carrega a solicitação;
//   2. pergunta ao workflow (módulo puro) se a transição é válida para este ator;
//   3. escreve com guard de status na cláusula WHERE (compare-and-swap);
//   4. registra o evento no histórico;
//   5. avisa o gestor por e-mail quando fizer sentido.
//
// O passo 3 é o que impede duas requisições simultâneas de aprovar duas vezes: o UPDATE
// só encontra a linha se o status ainda for o esperado. A criação da vaga é mais forte
// ainda — roda inteira dentro de create_job_from_request() no banco.

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidEmail, sendEmail } from "@/lib/email";
import { jobRequestDecisionEmail, type DecisionKind } from "@/lib/email-templates";
import { generateSlug } from "@/lib/utils";
import type { JobRequestStatus } from "@/types/domain";
import type {
  JobRequestApprovalRow,
  JobRequestHistoryRow,
  JobRequestRow,
} from "@/types/job-requests";
import {
  buildApprovalChain,
  canRunAction,
  evaluateEdit,
  findCriticalChanges,
  isAdmin,
  REAPPROVAL_STATUS,
  type CriticalField,
  type WorkflowActionId,
  type WorkflowActor,
  type WorkflowRequest,
} from "./workflow";
import { payloadToColumns, type JobRequestDraft, type JobRequestPayload } from "./schema";

export type ServiceResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const LIST_PATH = "/solicitacoes";

// ─── Sessão → ator do workflow ────────────────────────────────────────────────

/**
 * Lê a sessão e monta o ator. `isApprover` vem da tabela `users` — é o que permite a um
 * VIEWER_RH decidir uma solicitação destinada a ele sem virar ADMIN_RH.
 */
export async function currentActor(): Promise<WorkflowActor | null> {
  const session = await auth();
  if (!session) return null;

  let approver = false;
  if (session.user.id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("users")
      .select("isApprover")
      .eq("id", session.user.id)
      .maybeSingle();
    approver = Boolean((data as { isApprover?: boolean } | null)?.isApprover);
  }

  return {
    userId: session.user.id ?? null,
    name: session.user.name ?? session.user.email ?? "Gente & Gestão",
    role: session.user.role,
    isApprover: approver,
  };
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

const SELECT_COLUMNS = `
  id, code, status, title, department, location, requester_name, requester_email,
  requested_by_user_id, openings, reason_type, replaced_employee, justification,
  desired_start_date, contract_type, modality, work_schedule, extra_data,
  submitted_at, hr_validated_at, hr_validated_by,
  current_approver_user_id, approved_at, approved_by_name, decision_note, decided_by,
  decided_at, job_id, created_at, updated_at
`;

interface RawRequest {
  id: string;
  code: string | null;
  status: JobRequestStatus;
  title: string | null;
  department: string | null;
  location: string | null;
  requester_name: string | null;
  requester_email: string | null;
  requested_by_user_id: string | null;
  openings: number | null;
  reason_type: JobRequestRow["reasonType"];
  replaced_employee: string | null;
  justification: string | null;
  desired_start_date: string | null;
  contract_type: JobRequestRow["contractType"];
  modality: JobRequestRow["modality"];
  work_schedule: string | null;
  extra_data: Record<string, string> | null;
  submitted_at: string | null;
  hr_validated_at: string | null;
  hr_validated_by: string | null;
  current_approver_user_id: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
}

function num(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toRow(
  r: RawRequest,
  extras: {
    job?: { code: string | null; title: string; status: string };
    approverName?: string | null;
  } = {}
): JobRequestRow {
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    title: r.title,
    department: r.department,
    location: r.location,
    requesterName: r.requester_name,
    requesterEmail: r.requester_email,
    requestedByUserId: r.requested_by_user_id,
    openings: r.openings,
    reasonType: r.reason_type ?? "OTHER",
    replacedEmployee: r.replaced_employee,
    justification: r.justification,
    desiredStartDate: r.desired_start_date,
    contractType: r.contract_type,
    modality: r.modality,
    workSchedule: r.work_schedule,
    submittedAt: r.submitted_at,
    hrValidatedAt: r.hr_validated_at,
    hrValidatedBy: r.hr_validated_by,
    currentApproverUserId: r.current_approver_user_id,
    currentApproverName: extras.approverName ?? null,
    approvedAt: r.approved_at,
    approvedByName: r.approved_by_name,
    decisionNote: r.decision_note,
    decidedBy: r.decided_by,
    decidedAt: r.decided_at,
    jobId: r.job_id,
    jobCode: extras.job?.code ?? null,
    jobTitle: extras.job?.title ?? null,
    jobStatus: extras.job?.status ?? null,
    extraData: r.extra_data ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Lista para a tela de Solicitações (já enriquecida com vaga e aprovador). */
export async function listJobRequests(limit = 300): Promise<JobRequestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_requests")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[job-requests] list:", error);
    return [];
  }
  const rows = (data ?? []) as unknown as RawRequest[];
  const [jobsById, usersById] = await Promise.all([
    loadJobs(rows.map((r) => r.job_id)),
    loadUserNames(rows.map((r) => r.current_approver_user_id)),
  ]);

  return rows.map((r) =>
    toRow(r, {
      job: r.job_id ? jobsById.get(r.job_id) : undefined,
      approverName: r.current_approver_user_id
        ? (usersById.get(r.current_approver_user_id) ?? null)
        : null,
    })
  );
}

export async function getJobRequest(id: string): Promise<JobRequestRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_requests")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const r = data as unknown as RawRequest;
  const [jobsById, usersById] = await Promise.all([
    loadJobs([r.job_id]),
    loadUserNames([r.current_approver_user_id]),
  ]);
  return toRow(r, {
    job: r.job_id ? jobsById.get(r.job_id) : undefined,
    approverName: r.current_approver_user_id
      ? (usersById.get(r.current_approver_user_id) ?? null)
      : null,
  });
}

export async function getJobRequestHistory(id: string): Promise<JobRequestHistoryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_request_history")
    .select("id, event, from_status, to_status, comment, actor_name, created_at")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  return ((data ?? []) as Array<Record<string, string | null>>).map((h) => ({
    id: String(h.id),
    event: String(h.event),
    fromStatus: h.from_status,
    toStatus: h.to_status,
    comment: h.comment,
    actorName: h.actor_name,
    createdAt: String(h.created_at),
  }));
}

export async function getJobRequestApprovals(id: string): Promise<JobRequestApprovalRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_request_approvals")
    .select("id, step_order, rule_key, approver_user_id, approver_name, status, comment, decided_at")
    .eq("request_id", id)
    .order("step_order", { ascending: true });

  return ((data ?? []) as Array<Record<string, unknown>>).map((a) => ({
    id: String(a.id),
    stepOrder: Number(a.step_order),
    ruleKey: (a.rule_key as string | null) ?? null,
    approverUserId: (a.approver_user_id as string | null) ?? null,
    approverName: (a.approver_name as string | null) ?? null,
    status: a.status as JobRequestApprovalRow["status"],
    comment: (a.comment as string | null) ?? null,
    decidedAt: (a.decided_at as string | null) ?? null,
  }));
}

/** Usuários elegíveis a aprovar (flag isApprover ou ADMIN_RH), para o seletor do RH. */
export async function listApprovers(): Promise<Array<{ id: string; name: string; email: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, name, email, role, isApprover, active")
    .eq("active", true)
    .order("name");

  return ((data ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    isApprover: boolean;
  }>)
    .filter((u) => u.isApprover || u.role === "ADMIN_RH")
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));
}

async function loadJobs(ids: Array<string | null>) {
  const map = new Map<string, { code: string | null; title: string; status: string }>();
  const clean = ids.filter((id): id is string => Boolean(id));
  if (clean.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("id, code, title, status").in("id", clean);
  for (const j of (data ?? []) as Array<{
    id: string;
    code: string | null;
    title: string;
    status: string;
  }>) {
    map.set(j.id, { code: j.code, title: j.title, status: j.status });
  }
  return map;
}

async function loadUserNames(ids: Array<string | null>) {
  const map = new Map<string, string>();
  const clean = ids.filter((id): id is string => Boolean(id));
  if (clean.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase.from("users").select("id, name").in("id", clean);
  for (const u of (data ?? []) as Array<{ id: string; name: string }>) map.set(u.id, u.name);
  return map;
}

// ─── Infraestrutura comum das transições ──────────────────────────────────────

function asWorkflowRequest(r: RawRequest | JobRequestRow): WorkflowRequest {
  const requestedBy =
    "requested_by_user_id" in r ? r.requested_by_user_id : r.requestedByUserId;
  const approver =
    "current_approver_user_id" in r ? r.current_approver_user_id : r.currentApproverUserId;
  const jobId = "job_id" in r ? r.job_id : r.jobId;
  return {
    status: r.status,
    requestedByUserId: requestedBy ?? null,
    currentApproverUserId: approver ?? null,
    jobId: jobId ?? null,
  };
}

async function loadRaw(id: string): Promise<RawRequest | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_requests")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as RawRequest | null) ?? null;
}

interface HistoryEntry {
  event: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  comment?: string | null;
}

async function recordHistory(
  requestId: string,
  actor: WorkflowActor,
  entry: HistoryEntry
): Promise<void> {
  // Escrita de auditoria: nunca derruba a ação principal se falhar.
  const supabase = await createClient();
  const { error } = await supabase.from("job_request_history").insert({
    request_id: requestId,
    event: entry.event,
    from_status: entry.fromStatus ?? null,
    to_status: entry.toStatus ?? null,
    comment: (entry.comment ?? "").trim() || null,
    actor_user_id: actor.userId,
    actor_name: actor.name,
  });
  if (error) console.error("[job-requests] history:", error);
}

const DECISION_EMAIL_BY_ACTION: Partial<Record<WorkflowActionId, DecisionKind>> = {
  HR_VALIDATE: "IN_REVIEW",
  HR_RETURN: "RETURNED",
  APPROVER_RETURN: "RETURNED",
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  CANCEL: "CANCELLED",
  START_RECRUITMENT: "RECRUITING",
};

async function notifyRequester(
  r: RawRequest,
  kind: DecisionKind,
  note: string | null,
  actor: WorkflowActor
): Promise<void> {
  if (!isValidEmail(r.requester_email)) return;
  const { subject, html } = jobRequestDecisionEmail({
    kind,
    jobTitle: r.title ?? "",
    requestCode: r.code,
    requesterName: r.requester_name,
    note,
    decidedBy: actor.name,
  });
  await sendEmail({ to: r.requester_email, subject, html }).catch((err) =>
    console.error("[email] decisão de solicitação:", err)
  );
}

function revalidate(id?: string): void {
  revalidatePath(LIST_PATH);
  if (id) revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/vagas/gerenciar");
}

// ─── Transições ───────────────────────────────────────────────────────────────

export interface TransitionInput {
  comment?: string | null;
  /** HR_VALIDATE: quem vai aprovar. */
  approverUserId?: string | null;
}

/**
 * Executa uma ação do workflow. Nunca recebe "o status novo" do cliente — recebe a AÇÃO,
 * e o status de destino sai da definição em workflow.ts (regra 15: nada de dropdown livre).
 */
export async function runWorkflowAction(
  requestId: string,
  actionId: WorkflowActionId,
  input: TransitionInput = {}
): Promise<ServiceResult> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Não autenticado." };

  const raw = await loadRaw(requestId);
  if (!raw) return { ok: false, error: "Solicitação não encontrada." };

  const comment = (input.comment ?? "").trim();
  const verdict = canRunAction(actionId, asWorkflowRequest(raw), actor, comment);
  if (!verdict.ok) return { ok: false, error: verdict.message };

  if (actionId === "START_RECRUITMENT") {
    const res = await startRecruitment(requestId, actor, raw);
    return res.ok ? { ok: true, data: undefined } : res;
  }

  const target = ({
    SUBMIT: "PENDING_HR",
    HR_VALIDATE: "PENDING_APPROVAL",
    HR_RETURN: "RETURNED",
    APPROVE: "APPROVED",
    APPROVER_RETURN: "RETURNED",
    REJECT: "REJECTED",
    CANCEL: "CANCELLED",
    REOPEN: "PENDING_HR",
    START_RECRUITMENT: "RECRUITING",
  } satisfies Record<WorkflowActionId, JobRequestStatus>)[actionId];

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: target };
  const isDecision = actionId !== "SUBMIT" && actionId !== "REOPEN";

  if (isDecision) {
    patch.decision_note = comment || null;
    patch.decided_by = actor.name;
    patch.decided_at = now;
  }

  switch (actionId) {
    case "SUBMIT":
      patch.submitted_at = now;
      patch.decision_note = null;
      patch.decided_by = null;
      patch.decided_at = null;
      break;
    case "HR_VALIDATE": {
      patch.hr_validated_at = now;
      patch.hr_validated_by = actor.name;
      patch.current_approver_user_id = input.approverUserId || null;
      if (!input.approverUserId) {
        return { ok: false, error: "Escolha quem vai aprovar esta solicitação." };
      }
      break;
    }
    case "APPROVE":
      patch.approved_at = now;
      patch.approved_by_user_id = actor.userId;
      patch.approved_by_name = actor.name;
      break;
    case "HR_RETURN":
    case "APPROVER_RETURN":
    case "REJECT":
      // Devolvida/reprovada perde a aprovação anterior — o ciclo recomeça.
      patch.approved_at = null;
      patch.approved_by_user_id = null;
      patch.approved_by_name = null;
      break;
    case "REOPEN":
      patch.current_approver_user_id = null;
      patch.approved_at = null;
      patch.approved_by_user_id = null;
      patch.approved_by_name = null;
      patch.decision_note = null;
      break;
  }

  const supabase = await createClient();
  // Compare-and-swap: o guard de status na cláusula WHERE impede que duas requisições
  // simultâneas apliquem a mesma decisão duas vezes.
  const { data: updated, error } = await supabase
    .from("job_requests")
    .update(patch)
    .eq("id", requestId)
    .eq("status", raw.status)
    .select("id");

  if (error) {
    console.error("[job-requests] transition:", error);
    return { ok: false, error: "Não foi possível atualizar a solicitação." };
  }
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error: "A solicitação mudou de status enquanto você decidia. Recarregue a página.",
    };
  }

  await syncApprovalSteps(requestId, actionId, actor, comment, input.approverUserId ?? null);
  await recordHistory(requestId, actor, {
    event: actionId === "SUBMIT" ? "SUBMITTED" : actionId,
    fromStatus: raw.status,
    toStatus: target,
    comment,
  });

  const emailKind = DECISION_EMAIL_BY_ACTION[actionId];
  if (emailKind) await notifyRequester(raw, emailKind, comment || null, actor);

  revalidate(requestId);
  return { ok: true, data: undefined };
}

/** Mantém `job_request_approvals` em dia — a base do fluxo condicional futuro. */
async function syncApprovalSteps(
  requestId: string,
  actionId: WorkflowActionId,
  actor: WorkflowActor,
  comment: string,
  approverUserId: string | null
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (actionId === "HR_VALIDATE") {
    const raw = await loadRaw(requestId);
    if (!raw) return;
    // Passos antigos de um ciclo anterior deixam de valer.
    await supabase
      .from("job_request_approvals")
      .update({ status: "SKIPPED" })
      .eq("request_id", requestId)
      .eq("status", "PENDING");

    const approverName = approverUserId
      ? ((await loadUserNames([approverUserId])).get(approverUserId) ?? null)
      : null;

    const chain = buildApprovalChain(
      { reasonType: raw.reason_type ?? "OTHER" },
      approverUserId
    );

    await supabase.from("job_request_approvals").insert(
      chain.map((step) => ({
        request_id: requestId,
        step_order: step.stepOrder,
        rule_key: step.ruleKey,
        approver_user_id: step.approverUserId,
        approver_name: step.approverUserId ? approverName : null,
        status: "PENDING",
      }))
    );
    return;
  }

  const decision =
    actionId === "APPROVE"
      ? "APPROVED"
      : actionId === "REJECT"
        ? "REJECTED"
        : actionId === "APPROVER_RETURN" || actionId === "HR_RETURN"
          ? "RETURNED"
          : actionId === "CANCEL" || actionId === "REOPEN"
            ? "SKIPPED"
            : null;

  if (!decision) return;

  await supabase
    .from("job_request_approvals")
    .update({
      status: decision,
      comment: comment || null,
      decided_at: decision === "SKIPPED" ? null : now,
      approver_name: decision === "SKIPPED" ? undefined : actor.name,
    })
    .eq("request_id", requestId)
    .eq("status", "PENDING");
}

// ─── Criar processo seletivo ──────────────────────────────────────────────────

export interface StartRecruitmentResult {
  jobId: string;
  jobCode: string | null;
  requestCode: string | null;
}

/**
 * "CRIAR PROCESSO SELETIVO": a única forma de uma solicitação virar vaga.
 *
 * A criação inteira (insert da vaga + vínculo nos dois lados + mudança de status +
 * histórico) acontece em uma transação no banco, com `for update` na solicitação. Clicar
 * duas vezes não gera duas vagas — a segunda chamada encontra `job_id` preenchido e falha.
 */
async function startRecruitment(
  requestId: string,
  actor: WorkflowActor,
  raw: RawRequest
): Promise<ServiceResult<StartRecruitmentResult>> {
  const supabase = await createClient();
  const slugBase = generateSlug(raw.title ?? "vaga", raw.location);

  const { data, error } = await supabase.rpc("create_job_from_request", {
    p_request_id: requestId,
    p_actor_user_id: actor.userId,
    p_actor_name: actor.name,
    p_slug_base: slugBase,
  });

  if (error) {
    console.error("[job-requests] create_job_from_request:", error);
    // Mensagens do RAISE chegam legíveis — vale repassar (são regras de negócio).
    const message = error.message?.includes("solicitação")
      ? error.message
      : "Não foi possível criar o processo seletivo.";
    return { ok: false, error: message };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { job_id: string; job_code: string | null; request_code: string | null }
    | undefined;

  if (!row?.job_id) {
    return { ok: false, error: "Não foi possível criar o processo seletivo." };
  }

  await notifyRequester(raw, "RECRUITING", null, actor);
  revalidate(requestId);

  return {
    ok: true,
    data: { jobId: row.job_id, jobCode: row.job_code, requestCode: row.request_code },
  };
}

export async function createJobFromRequest(
  requestId: string
): Promise<ServiceResult<StartRecruitmentResult>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Não autenticado." };

  const raw = await loadRaw(requestId);
  if (!raw) return { ok: false, error: "Solicitação não encontrada." };

  const verdict = canRunAction("START_RECRUITMENT", asWorkflowRequest(raw), actor);
  if (!verdict.ok) return { ok: false, error: verdict.message };

  return startRecruitment(requestId, actor, raw);
}

// ─── Criação e edição ─────────────────────────────────────────────────────────

export interface CreateInput {
  payload: JobRequestPayload;
  /** Público (sem sessão) ou interno. */
  requestedByUserId?: string | null;
  /** Rascunho = fica com o gestor; caso contrário já entra na fila do RH. */
  asDraft?: boolean;
  actorName?: string;
}

/**
 * Cria a solicitação. Usado pelo formulário público (service-role, sem sessão) e pela
 * criação interna. Uma solicitação NUNCA cria uma vaga aqui.
 */
export async function createJobRequest(
  input: CreateInput
): Promise<ServiceResult<{ id: string; code: string | null }>> {
  const status: JobRequestStatus = input.asDraft ? "DRAFT" : "PENDING_HR";
  const now = new Date().toISOString();

  // Sem sessão (formulário público) o insert vai pelo service-role: a RLS de job_requests
  // só permite escrita a ADMIN_RH, e o gestor que preenche o formulário não tem login.
  const supabase = input.requestedByUserId ? await createClient() : createAdminClient();

  const { data, error } = await supabase
    .from("job_requests")
    .insert({
      ...payloadToColumns(input.payload),
      form_data: {}, // legado: o formulário deixou de ser texto livre
      status,
      requested_by_user_id: input.requestedByUserId ?? null,
      submitted_at: input.asDraft ? null : now,
    })
    .select("id, code")
    .single();

  if (error || !data) {
    console.error("[job-requests] insert:", error);
    return { ok: false, error: "Não foi possível registrar a solicitação." };
  }

  const row = data as { id: string; code: string | null };
  const actor: WorkflowActor = {
    userId: input.requestedByUserId ?? null,
    name: input.actorName ?? input.payload.requesterName ?? "Gestor",
    role: input.requestedByUserId ? "ADMIN_RH" : "SYSTEM",
    isApprover: false,
  };

  // Histórico no mesmo client usado no insert (o público não passa pela RLS de staff).
  await supabase.from("job_request_history").insert([
    {
      request_id: row.id,
      event: "CREATED",
      to_status: "DRAFT",
      actor_user_id: input.requestedByUserId ?? null,
      actor_name: actor.name,
    },
    ...(input.asDraft
      ? []
      : [
          {
            request_id: row.id,
            event: "SUBMITTED",
            from_status: "DRAFT",
            to_status: "PENDING_HR",
            actor_user_id: input.requestedByUserId ?? null,
            actor_name: actor.name,
          },
        ]),
  ]);

  revalidate(row.id);
  return { ok: true, data: row };
}

export interface UpdateResult {
  requiresReapproval: boolean;
  changed: CriticalField[];
}

/**
 * Edita a solicitação.
 *
 * Regra 9: se um campo crítico mudar depois da aprovação, a aprovação anterior é
 * invalidada — a solicitação volta para "Aguardando aprovação" e o recrutamento fica
 * bloqueado até a nova decisão. O chamador precisa mandar `confirmReapproval: true`
 * (é o "sim" do usuário ao aviso), senão a edição é recusada com a lista de campos.
 */
export async function updateJobRequest(
  requestId: string,
  payload: JobRequestPayload | JobRequestDraft,
  opts: { confirmReapproval?: boolean } = {}
): Promise<ServiceResult<UpdateResult>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Não autenticado." };

  const raw = await loadRaw(requestId);
  if (!raw) return { ok: false, error: "Solicitação não encontrada." };

  const before: Record<CriticalField, unknown> = {
    title: raw.title,
    openings: raw.openings,
    location: raw.location,
    contractType: raw.contract_type,
    reasonType: raw.reason_type,
  };
  const changed = findCriticalChanges(before, payload as Record<string, unknown>);
  const decision = evaluateEdit(asWorkflowRequest(raw), actor, changed);

  if (!decision.allowed) return { ok: false, error: decision.message };

  if (decision.requiresReapproval && !opts.confirmReapproval) {
    return { ok: false, error: decision.warning };
  }

  const patch: Record<string, unknown> = payloadToColumns(payload);
  if (decision.requiresReapproval) {
    patch.status = REAPPROVAL_STATUS;
    patch.approved_at = null;
    patch.approved_by_user_id = null;
    patch.approved_by_name = null;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_requests")
    .update(patch)
    .eq("id", requestId)
    .eq("status", raw.status);

  if (error) {
    console.error("[job-requests] update:", error);
    return { ok: false, error: "Não foi possível salvar as alterações." };
  }

  await recordHistory(requestId, actor, {
    event: "UPDATED",
    fromStatus: raw.status,
    toStatus: decision.requiresReapproval ? REAPPROVAL_STATUS : raw.status,
    comment: decision.requiresReapproval
      ? `Campos aprovados alterados: ${changed.join(", ")}.`
      : null,
  });

  if (decision.requiresReapproval) {
    // Reabre o passo de aprovação para quem já era o aprovador da vez.
    await supabase
      .from("job_request_approvals")
      .update({ status: "PENDING", decided_at: null, comment: null })
      .eq("request_id", requestId)
      .in("status", ["APPROVED", "RETURNED"]);

    await recordHistory(requestId, actor, {
      event: "REAPPROVAL_REQUIRED",
      fromStatus: raw.status,
      toStatus: REAPPROVAL_STATUS,
      comment: changed.join(", "),
    });
  }

  revalidate(requestId);
  return {
    ok: true,
    data: { requiresReapproval: decision.requiresReapproval, changed },
  };
}

/** Só o ADMIN_RH troca o aprovador de uma solicitação já encaminhada. */
export async function reassignApprover(
  requestId: string,
  approverUserId: string
): Promise<ServiceResult> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Não autenticado." };
  if (!isAdmin(actor)) return { ok: false, error: "Sem permissão." };

  const supabase = await createClient();
  const name = (await loadUserNames([approverUserId])).get(approverUserId) ?? null;

  const { error } = await supabase
    .from("job_requests")
    .update({ current_approver_user_id: approverUserId })
    .eq("id", requestId)
    .eq("status", "PENDING_APPROVAL");

  if (error) return { ok: false, error: "Não foi possível trocar o aprovador." };

  await supabase
    .from("job_request_approvals")
    .update({ approver_user_id: approverUserId, approver_name: name })
    .eq("request_id", requestId)
    .eq("status", "PENDING");

  await recordHistory(requestId, actor, {
    event: "UPDATED",
    comment: `Aprovador alterado para ${name ?? approverUserId}.`,
  });

  revalidate(requestId);
  return { ok: true, data: undefined };
}
