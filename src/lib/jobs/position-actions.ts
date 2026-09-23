"use server";

// Ações das POSIÇÕES da vaga (casca fina sobre as funções do banco).
//
// A regra — travas, "posição ocupada não aceita outro", "vaga específica mantém ao menos
// uma posição", histórico — mora em job_position_*() no banco
// (supabase/migrations/20260923200000_job_positions.sql). Aqui só autenticamos, chamamos a
// função com o ator e revalidamos as telas. As mensagens de RAISE chegam legíveis e são
// repassadas ao RH.

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PositionsSnapshot = {
  total: number;
  filled: number;
  open: number;
  cancelled: number;
  allFilled: boolean;
};

export type PositionActionResult =
  | { ok: true; summary: PositionsSnapshot }
  | { ok: false; error: string };

async function actor() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") return null;
  return { userId: session.user.id, name: session.user.name ?? session.user.email ?? "Admin" };
}

function revalidateJob(jobId: string) {
  revalidatePath(`/vagas/${jobId}/editar`);
  revalidatePath(`/vagas/${jobId}/candidatos`);
  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

function toResult(data: unknown, error: { message?: string } | null): PositionActionResult {
  if (error) return { ok: false, error: error.message || "Não foi possível concluir a operação." };
  const s = (data ?? {}) as Partial<PositionsSnapshot>;
  return {
    ok: true,
    summary: {
      total: Number(s.total ?? 0),
      filled: Number(s.filled ?? 0),
      open: Number(s.open ?? 0),
      cancelled: Number(s.cancelled ?? 0),
      allFilled: Boolean(s.allFilled),
    },
  };
}

export async function addPositionAction(jobId: string, reason: string): Promise<PositionActionResult> {
  const a = await actor();
  if (!a) return { ok: false, error: "Não autorizado." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("job_position_add", {
    p_job_id: jobId,
    p_reason: reason.trim() || null,
    p_actor_user_id: a.userId,
    p_actor_name: a.name,
  });
  revalidateJob(jobId);
  return toResult(data, error);
}

export async function cancelPositionAction(
  jobId: string,
  positionId: string,
  reason: string
): Promise<PositionActionResult> {
  const a = await actor();
  if (!a) return { ok: false, error: "Não autorizado." };
  if (!reason.trim()) return { ok: false, error: "Informe o motivo do cancelamento." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("job_position_cancel", {
    p_position_id: positionId,
    p_reason: reason.trim(),
    p_actor_user_id: a.userId,
    p_actor_name: a.name,
  });
  revalidateJob(jobId);
  return toResult(data, error);
}

export async function releasePositionAction(
  jobId: string,
  positionId: string,
  reason: string
): Promise<PositionActionResult> {
  const a = await actor();
  if (!a) return { ok: false, error: "Não autorizado." };
  if (!reason.trim()) return { ok: false, error: "Informe o motivo (ex.: desistência do candidato)." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("job_position_release", {
    p_position_id: positionId,
    p_reason: reason.trim(),
    p_actor_user_id: a.userId,
    p_actor_name: a.name,
  });
  revalidateJob(jobId);
  return toResult(data, error);
}

/**
 * Vincula manualmente um contratado a uma posição — para quem foi contratado sem passar
 * pelo modal de admissão (etapa "Contratado" sem automação, contratações anteriores).
 * Se o candidato já tem admissão aberta a partir desta vaga, ela é ligada à posição.
 */
export async function fillPositionAction(
  jobId: string,
  positionId: string,
  applicationId: string,
  expectedStartDate: string | null
): Promise<PositionActionResult> {
  const a = await actor();
  if (!a) return { ok: false, error: "Não autorizado." };
  const supabase = await createClient();
  const { data: admission } = await supabase
    .from("admissions")
    .select("id")
    .eq("sourceApplicationId", applicationId)
    .is("deletedAt", null)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase.rpc("job_position_fill", {
    p_position_id: positionId,
    p_application_id: applicationId,
    p_admission_id: (admission as { id: string } | null)?.id ?? null,
    p_expected_start: expectedStartDate || null,
    p_actor_user_id: a.userId,
    p_actor_name: a.name,
  });
  revalidateJob(jobId);
  return toResult(data, error);
}

/** "Encerrar vaga" depois que todas as posições foram preenchidas (o RH confirma). */
export async function closeFilledJobAction(jobId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await actor();
  if (!a) return { ok: false, error: "Não autorizado." };
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("status, slug").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Vaga não encontrada." };
  if (job.status === "FILLED") return { ok: true };
  const { error } = await supabase.from("jobs").update({ status: "FILLED" }).eq("id", jobId).eq("status", job.status);
  if (error) return { ok: false, error: "Não foi possível encerrar a vaga." };
  await supabase.from("job_status_history").insert({ jobId, status: "FILLED", changedBy: a.name });
  revalidateJob(jobId);
  if (job.slug) revalidatePath(`/vagas/${job.slug}`);
  return { ok: true };
}
