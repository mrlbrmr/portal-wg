"use server";

// Server actions da solicitação de vaga — casca fina sobre src/lib/job-requests/service.ts.
//
// Nenhuma regra de negócio aqui: a validação de status, permissão e comentário obrigatório
// acontece no service (que consulta workflow.ts). Isso mantém a UI incapaz de "pular"
// uma etapa mesmo que alguém chame a action direto.

import {
  createJobFromRequest as createJobFromRequestUseCase,
  createJobRequest as createJobRequestUseCase,
  reassignApprover as reassignApproverUseCase,
  runWorkflowAction,
  updateJobRequest as updateJobRequestUseCase,
  type ServiceResult,
  type StartRecruitmentResult,
} from "./service";
import { jobRequestPayloadSchema, type JobRequestPayload } from "./schema";
import { currentActor } from "./service";
import { validateExtraData } from "./extra-fields";
import { loadJobRequestFormConfig } from "./form-config-loader";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toActionResult(res: ServiceResult<unknown>): ActionResult {
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

// ─── Transições do workflow ───────────────────────────────────────────────────

/** Gestor (ou RH) envia a solicitação para validação do RH. */
export async function submitJobRequest(id: string): Promise<ActionResult> {
  return toActionResult(await runWorkflowAction(id, "SUBMIT"));
}

/** RH valida e encaminha para o aprovador escolhido. */
export async function validateJobRequest(
  id: string,
  approverUserId: string,
  note?: string
): Promise<ActionResult> {
  return toActionResult(
    await runWorkflowAction(id, "HR_VALIDATE", { approverUserId, comment: note })
  );
}

/** RH devolve ao gestor (comentário obrigatório). */
export async function returnJobRequestByHr(id: string, note: string): Promise<ActionResult> {
  return toActionResult(await runWorkflowAction(id, "HR_RETURN", { comment: note }));
}

/** Aprovador devolve para ajuste (comentário obrigatório). */
export async function returnJobRequestByApprover(
  id: string,
  note: string
): Promise<ActionResult> {
  return toActionResult(await runWorkflowAction(id, "APPROVER_RETURN", { comment: note }));
}

/** Aprovador aprova (comentário opcional). */
export async function approveJobRequest(id: string, note?: string): Promise<ActionResult> {
  return toActionResult(await runWorkflowAction(id, "APPROVE", { comment: note }));
}

/** Aprovador reprova (comentário obrigatório). */
export async function rejectJobRequest(id: string, note: string): Promise<ActionResult> {
  return toActionResult(await runWorkflowAction(id, "REJECT", { comment: note }));
}

/** Cancelamento (comentário obrigatório — é uma ação sensível). */
export async function cancelJobRequest(id: string, note: string): Promise<ActionResult> {
  return toActionResult(await runWorkflowAction(id, "CANCEL", { comment: note }));
}

/** Reabre uma solicitação reprovada ou cancelada, devolvendo-a à fila do RH. */
export async function reopenJobRequest(id: string): Promise<ActionResult> {
  return toActionResult(await runWorkflowAction(id, "REOPEN"));
}

/** RH troca o aprovador da vez. */
export async function reassignJobRequestApprover(
  id: string,
  approverUserId: string
): Promise<ActionResult> {
  return toActionResult(await reassignApproverUseCase(id, approverUserId));
}

// ─── Criar processo seletivo ──────────────────────────────────────────────────

export type StartRecruitmentActionResult =
  | { ok: true; jobId: string; jobCode: string | null }
  | { ok: false; error: string };

/**
 * "CRIAR PROCESSO SELETIVO". A vaga nasce aqui — e só aqui. Transacional no banco:
 * um segundo clique não cria uma segunda vaga.
 */
export async function startRecruitmentFromRequest(
  id: string
): Promise<StartRecruitmentActionResult> {
  const res: ServiceResult<StartRecruitmentResult> = await createJobFromRequestUseCase(id);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, jobId: res.data.jobId, jobCode: res.data.jobCode };
}

// ─── Criação e edição ─────────────────────────────────────────────────────────

export type CreateActionResult =
  | { ok: true; id: string; code: string | null }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Criação interna (RH ou gestor logado). O formulário público usa POST /api/job-requests. */
export async function createJobRequestInternal(
  input: unknown,
  asDraft = false
): Promise<CreateActionResult> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Não autenticado." };

  const parsed = jobRequestPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Rascunho pode ficar incompleto; ao enviar, as perguntas obrigatórias visíveis valem.
  if (!asDraft) {
    const { fields } = await loadJobRequestFormConfig();
    const extraErrors = validateExtraData(fields, parsed.data.extraData);
    if (Object.keys(extraErrors).length > 0) {
      return {
        ok: false,
        error: "Revise os campos destacados.",
        fieldErrors: Object.fromEntries(Object.entries(extraErrors).map(([k, v]) => [k, [v]])),
      };
    }
  }

  const res = await createJobRequestUseCase({
    payload: parsed.data,
    requestedByUserId: actor.userId,
    actorName: actor.name,
    asDraft,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, id: res.data.id, code: res.data.code };
}

export type UpdateActionResult =
  | { ok: true; requiresReapproval: boolean }
  /** `needsConfirmation` = a edição mexe em dado aprovado e espera o "sim" do usuário. */
  | {
      ok: false;
      error: string;
      needsConfirmation?: boolean;
      fieldErrors?: Record<string, string[]>;
    };

export async function saveJobRequest(
  id: string,
  input: unknown,
  opts: { confirmReapproval?: boolean } = {}
): Promise<UpdateActionResult> {
  const parsed = jobRequestPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const res = await updateJobRequestUseCase(id, parsed.data as JobRequestPayload, opts);
  if (!res.ok) {
    return {
      ok: false,
      error: res.error,
      // A recusa por reaprovação é a única que o usuário pode "vencer" confirmando.
      needsConfirmation: res.error.includes("nova aprovação"),
    };
  }
  return { ok: true, requiresReapproval: res.data.requiresReapproval };
}
