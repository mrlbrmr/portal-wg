"use server";

// Ações da AGENDA DE ENTREVISTAS (casca fina). Regras puras em ./rules e ./schema.
// Toda mudança de status é compare-and-swap: UPDATE ... WHERE status = 'SCHEDULED'.
// Conflito de horário do entrevistador é só AVISO (retorna em `conflicts`), nunca erro.

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { INTERVIEW_COLUMNS, type InterviewRow } from "./catalog";
import { canTransition, findConflicts } from "./rules";
import { parseCancelReason, parseScheduleInput } from "./schema";

export type InterviewConflict = { candidateName: string; scheduledAt: string };
export type InterviewActionResult =
  | { ok: true; interview: InterviewRow; conflicts: InterviewConflict[] }
  | { ok: false; error: string };

const STALE = "A entrevista já foi alterada. Recarregue.";
const GENERIC = "Não foi possível concluir a operação.";
const WITH_APP = `${INTERVIEW_COLUMNS}, application:applications(fullName, jobId)`;

type Embed = { fullName?: string | null; jobId?: string | null };
type RowWithApp = InterviewRow & { application?: Embed | Embed[] | null };
type Supabase = Awaited<ReturnType<typeof createClient>>;

async function actor() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") return null;
  return { userId: session.user.id, name: session.user.name ?? session.user.email ?? "Admin" };
}

function embedOf(row: RowWithApp): Embed {
  const a = row.application;
  return (Array.isArray(a) ? a[0] : a) ?? {};
}

function strip(row: RowWithApp): InterviewRow {
  const { application: _application, ...rest } = row;
  return rest;
}

function revalidateJob(jobId: string | null | undefined) {
  if (!jobId) return;
  revalidatePath(`/vagas/${jobId}/candidatos`);
  revalidatePath(`/vagas/${jobId}/editar`);
}

/** Agendadas do mesmo dia ±1 que sobrepõem o horário do mesmo entrevistador. */
async function conflictsFor(supabase: Supabase, row: InterviewRow): Promise<InterviewConflict[]> {
  if (!row.interviewerName) return [];
  const t = new Date(row.scheduledAt).getTime();
  const { data } = await supabase
    .from("application_interviews")
    .select(WITH_APP)
    .eq("status", "SCHEDULED")
    .gte("scheduledAt", new Date(t - 86_400_000).toISOString())
    .lte("scheduledAt", new Date(t + 86_400_000).toISOString());
  const others = (data ?? []) as unknown as RowWithApp[];
  const ids = new Set(findConflicts(row, others));
  return others
    .filter((o) => ids.has(o.id))
    .map((o) => ({ candidateName: embedOf(o).fullName ?? "Candidato", scheduledAt: o.scheduledAt }));
}

export async function scheduleInterviewAction(input: unknown): Promise<InterviewActionResult> {
  const a = await actor();
  if (!a) return { ok: false, error: "Não autorizado." };
  const parsed = parseScheduleInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const v = parsed.value;

  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select("id, jobId")
    .eq("id", v.applicationId)
    .maybeSingle();
  if (!app) return { ok: false, error: "Candidatura não encontrada." };

  const { data, error } = await supabase
    .from("application_interviews")
    .insert({
      applicationId: v.applicationId,
      round: v.round,
      scheduledAt: v.scheduledAt,
      durationMin: v.durationMin,
      location: v.location,
      interviewerName: v.interviewerName,
      notes: v.notes,
      createdBy: a.name,
      updatedById: a.userId,
      updatedByName: a.name,
    })
    .select(INTERVIEW_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: GENERIC };

  const interview = data as unknown as InterviewRow;
  revalidateJob(app.jobId);
  return { ok: true, interview, conflicts: await conflictsFor(supabase, interview) };
}

export async function updateInterviewAction(id: string, input: unknown): Promise<InterviewActionResult> {
  const a = await actor();
  if (!a) return { ok: false, error: "Não autorizado." };
  const parsed = parseScheduleInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const v = parsed.value; // allowPast vem do próprio input (campo do schema)

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("application_interviews")
    .update({
      round: v.round,
      scheduledAt: v.scheduledAt,
      durationMin: v.durationMin,
      location: v.location,
      interviewerName: v.interviewerName,
      notes: v.notes,
      updatedById: a.userId,
      updatedByName: a.name,
    })
    .eq("id", id)
    .eq("status", "SCHEDULED")
    .select(WITH_APP)
    .maybeSingle();
  if (error) return { ok: false, error: GENERIC };
  if (!data) return { ok: false, error: STALE };

  const row = data as unknown as RowWithApp;
  const interview = strip(row);
  revalidateJob(embedOf(row).jobId);
  return { ok: true, interview, conflicts: await conflictsFor(supabase, interview) };
}

async function transition(
  id: string,
  to: "CANCELLED" | "NO_SHOW" | "DONE",
  extra: Record<string, unknown> = {},
  precheck?: (supabase: Supabase) => Promise<string | null>,
): Promise<InterviewActionResult> {
  const a = await actor();
  if (!a) return { ok: false, error: "Não autorizado." };
  if (!canTransition("SCHEDULED", to)) return { ok: false, error: STALE };

  const supabase = await createClient();
  if (precheck) {
    const err = await precheck(supabase);
    if (err) return { ok: false, error: err };
  }
  const { data, error } = await supabase
    .from("application_interviews")
    .update({ status: to, ...extra, updatedById: a.userId, updatedByName: a.name })
    .eq("id", id)
    .eq("status", "SCHEDULED")
    .select(WITH_APP)
    .maybeSingle();
  if (error) return { ok: false, error: GENERIC };
  if (!data) return { ok: false, error: STALE };

  const row = data as unknown as RowWithApp;
  revalidateJob(embedOf(row).jobId);
  return { ok: true, interview: strip(row), conflicts: [] };
}

export async function cancelInterviewAction(id: string, reason?: string): Promise<InterviewActionResult> {
  const r = parseCancelReason(reason);
  if (!r.ok) return { ok: false, error: r.error };
  return transition(id, "CANCELLED", { cancelReason: r.value });
}

export async function markNoShowAction(id: string): Promise<InterviewActionResult> {
  return transition(id, "NO_SHOW");
}

export async function completeInterviewAction(id: string, assessmentId: string): Promise<InterviewActionResult> {
  return transition(id, "DONE", { assessmentId }, async (supabase) => {
    const { data: iv } = await supabase
      .from("application_interviews")
      .select("applicationId")
      .eq("id", id)
      .maybeSingle();
    if (!iv) return STALE;
    const { data: assessment } = await supabase
      .from("application_assessments")
      .select("id")
      .eq("id", assessmentId)
      .eq("applicationId", (iv as unknown as { applicationId: string }).applicationId)
      .maybeSingle();
    return assessment ? null : "O parecer não pertence a esta candidatura.";
  });
}
