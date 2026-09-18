"use server";

// Server actions do fluxo de Requisição de Pessoal (RP).
// Escrita = ADMIN_RH (mesma regra das vagas). Cada decisão registra quem decidiu,
// quando e o parecer — e avisa o gestor por e-mail quando houver e-mail válido.

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail, sendEmail } from "@/lib/email";
import { jobRequestDecisionEmail, type DecisionKind } from "@/lib/email-templates";
import type { JobPriority, JobRequestStatus } from "@/types/domain";

export type ActionResult = { ok: true } | { ok: false; error: string };

const LIST_PATH = "/vagas/solicitacoes";

async function ensureAdmin(): Promise<{ name: string } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "Não autenticado." };
  if (session.user.role !== "ADMIN_RH") return { error: "Sem permissão." };
  return { name: session.user.name ?? session.user.email ?? "Gente & Gestão" };
}

interface RequestSnapshot {
  id: string;
  status: JobRequestStatus;
  title: string | null;
  requester_name: string | null;
  requester_email: string | null;
  job_id: string | null;
}

async function loadRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<RequestSnapshot | null> {
  const { data } = await supabase
    .from("job_requests")
    .select("id, status, title, requester_name, requester_email, job_id")
    .eq("id", id)
    .maybeSingle();
  return (data as RequestSnapshot | null) ?? null;
}

/** Dispara o aviso ao gestor sem derrubar a ação se o e-mail falhar. */
async function notifyRequester(
  request: RequestSnapshot,
  kind: DecisionKind,
  note: string | null,
  decidedBy: string
): Promise<void> {
  if (!isValidEmail(request.requester_email)) return;
  const { subject, html } = jobRequestDecisionEmail({
    kind,
    jobTitle: request.title ?? "",
    requesterName: request.requester_name,
    note,
    decidedBy,
  });
  await sendEmail({ to: request.requester_email, subject, html }).catch((err) =>
    console.error("[email] decisão de requisição:", err)
  );
}

function revalidateAll(): void {
  revalidatePath(LIST_PATH);
  revalidatePath("/dashboard");
}

/**
 * Transição genérica de status. `notifyKind` null = não avisa o gestor
 * (usado ao voltar uma requisição para a fila, por exemplo).
 */
async function transition(
  id: string,
  next: JobRequestStatus,
  opts: { note?: string; requireNote?: boolean; notify?: DecisionKind | null }
): Promise<ActionResult> {
  const admin = await ensureAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };

  const note = (opts.note ?? "").trim();
  if (opts.requireNote && !note) {
    return { ok: false, error: "Descreva o motivo para o gestor." };
  }

  const supabase = await createClient();
  const request = await loadRequest(supabase, id);
  if (!request) return { ok: false, error: "Solicitação não encontrada." };

  const isDecision = next !== "SUBMITTED" && next !== "IN_REVIEW";
  const { error } = await supabase
    .from("job_requests")
    .update({
      status: next,
      decision_note: note || null,
      decided_by: isDecision ? admin.name : null,
      decided_at: isDecision ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    console.error("job_requests update error:", error);
    return { ok: false, error: "Não foi possível atualizar a solicitação." };
  }

  if (opts.notify) {
    await notifyRequester(request, opts.notify, note || null, admin.name);
  }

  revalidateAll();
  return { ok: true };
}

/** RH assume a análise — some da fila "novas" e o gestor é avisado. */
export async function startReview(id: string): Promise<ActionResult> {
  return transition(id, "IN_REVIEW", { notify: "IN_REVIEW" });
}

/** Devolve ao gestor pedindo ajustes (motivo obrigatório). */
export async function returnRequest(id: string, note: string): Promise<ActionResult> {
  return transition(id, "RETURNED", { note, requireNote: true, notify: "RETURNED" });
}

/** Reprova com justificativa (motivo obrigatório — fica no histórico). */
export async function rejectRequest(id: string, note: string): Promise<ActionResult> {
  return transition(id, "REJECTED", { note, requireNote: true, notify: "REJECTED" });
}

/** Cancelamento (desistência do gestor ou duplicidade). */
export async function cancelRequest(id: string, note: string): Promise<ActionResult> {
  return transition(id, "CANCELLED", { note, notify: "CANCELLED" });
}

/** Reabre uma requisição encerrada, devolvendo-a à fila de análise. */
export async function reopenRequest(id: string): Promise<ActionResult> {
  return transition(id, "SUBMITTED", { notify: null });
}

/**
 * Aprova a requisição. A vaga NÃO é criada aqui: quem aprova é levado ao
 * formulário de vaga pré-preenchido (/vagas/nova?request=<id>), completa o que é
 * de RH e salva. O vínculo requisição ↔ vaga é fechado no POST /api/jobs.
 */
export async function approveRequest(id: string, note?: string): Promise<ActionResult> {
  return transition(id, "APPROVED", { note, notify: "APPROVED" });
}

/** Ajusta a prioridade da requisição na fila do RH. */
export async function setRequestPriority(
  id: string,
  priority: JobPriority
): Promise<ActionResult> {
  const admin = await ensureAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };

  const supabase = await createClient();
  const { error } = await supabase.from("job_requests").update({ priority }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível alterar a prioridade." };

  revalidateAll();
  return { ok: true };
}
