"use server";

// Vincular / desvincular a admissão a uma candidatura do processo seletivo.
// Regras puras em ./candidate-link.ts (a tela consulta as mesmas). Aqui: sessão, banco,
// compare-and-swap no vínculo e revalidação das telas que passam a mostrar a contratação.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionWrite } from "@/lib/admissao/permissions";
import { logActivity } from "@/lib/activity/log";
import {
  FILLABLE_LABELS,
  accentInsensitivePattern,
  blankFieldsFromCandidate,
  digitsOnly,
  firstLastName,
  hiringStages,
  linkBlocker,
  maskCpf,
  normalizeCpf,
  normalizeEmail,
  positionPlan,
  rankCandidates,
  sanitizeSearch,
  type FillableField,
  type LinkPosition,
  type LinkStage,
  type MatchReason,
  type PositionPlan,
} from "./candidate-link";

type Fail = { ok: false; error: string };

export interface LinkCandidate {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  cpfMasked: string | null;
  createdAt: string;
  jobId: string;
  jobLabel: string;
  jobClosed: boolean;
  stageName: string | null;
  stageColor: string | null;
  stageKind: string | null;
  reasons: MatchReason[];
  /** Motivo para não vincular (já ligada a outra admissão). */
  blocker: string | null;
}

const CANDIDATE_COLUMNS =
  "id, fullName, email, phone, cpf, createdAt, jobId, stageId, job:jobs(code, title, status), stage:application_stages(name, color, kind)";

type RawCandidate = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  createdAt: string;
  jobId: string;
  stageId: string | null;
  job: { code: string | null; title: string; status: string } | null;
  stage: { name: string; color: string | null; kind: string } | null;
};

async function loadAdmission(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase
    .from("admissions")
    .select("id, fullName, cpf, email, phone, sourceApplicationId")
    .eq("id", id)
    .is("deletedAt", null)
    .maybeSingle();
  return data as
    | { id: string; fullName: string; cpf: string | null; email: string | null; phone: string | null; sourceApplicationId: string | null }
    | null;
}

async function loadStages(supabase: Awaited<ReturnType<typeof createClient>>): Promise<LinkStage[]> {
  const { data } = await supabase.from("application_stages").select("id, name, kind, sortOrder, active");
  return (data ?? []) as LinkStage[];
}

/**
 * Candidaturas para vincular. Sem termo: sugestões (mesmo CPF, e-mail ou nome da admissão).
 * Com termo: busca por nome, e-mail ou CPF em todas as vagas.
 */
export async function searchLinkCandidates(
  admissionId: string,
  query: string
): Promise<{ ok: true; candidates: LinkCandidate[]; stages: LinkStage[] } | Fail> {
  const access = await requireAdmissionWrite();
  if (!access.ok) return { ok: false, error: "Não autorizado." };
  const supabase = await createClient();
  const admission = await loadAdmission(supabase, admissionId);
  if (!admission) return { ok: false, error: "Admissão não encontrada." };

  const q = sanitizeSearch(query);
  const filters: string[] = [];
  if (q) {
    filters.push(`fullName.ilike.%${q.split(" ").join("%")}%`, `email.ilike.%${q}%`);
    const d = digitsOnly(q);
    if (d.length >= 3) filters.push(`cpf_digits.like.%${d}%`);
  } else {
    const cpf = normalizeCpf(admission.cpf);
    if (cpf) filters.push(`cpf_digits.eq.${cpf}`);
    const email = normalizeEmail(sanitizeSearch(admission.email));
    if (email) filters.push(`email.ilike.${email}`);
    const name = firstLastName(admission.fullName);
    if (name) {
      filters.push(`fullName.ilike.%${accentInsensitivePattern(name.first)}%${accentInsensitivePattern(name.last)}%`);
    }
  }

  const stages = await loadStages(supabase);
  if (filters.length === 0) return { ok: true, candidates: [], stages: hiringStages(stages) };

  const { data, error } = await supabase
    .from("applications")
    .select(CANDIDATE_COLUMNS)
    .or(filters.join(","))
    .order("createdAt", { ascending: false })
    // Sugestões usam padrão de nome mais largo (sem acento): margem antes do filtro puro.
    .limit(q ? 30 : 60);
  if (error) {
    console.error("[candidate-link search]", error.message);
    return { ok: false, error: "Não foi possível buscar os candidatos." };
  }
  const raw = (data ?? []) as unknown as RawCandidate[];

  const ids = raw.map((r) => r.id);
  const { data: linkedRows } = ids.length
    ? await supabase.from("admissions").select("id, fullName, sourceApplicationId").in("sourceApplicationId", ids).is("deletedAt", null)
    : { data: [] };
  const linked = new Map(
    ((linkedRows ?? []) as Array<{ id: string; fullName: string; sourceApplicationId: string }>).map((l) => [l.sourceApplicationId, l])
  );

  const ranked = rankCandidates(
    admission,
    raw.map((r) => ({ ...r, stageKind: r.stage?.kind ?? null }))
  );
  const candidates: LinkCandidate[] = ranked
    // Sugestões só com motivo real (o ilike do nome pode trazer homônimos parciais).
    .filter((c) => q || c.reasons.length > 0)
    .map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      cpfMasked: maskCpf(c.cpf),
      createdAt: c.createdAt,
      jobId: c.jobId,
      jobLabel: c.job ? [c.job.code, c.job.title].filter(Boolean).join(" · ") : "Vaga removida",
      jobClosed: ["CLOSED", "FILLED", "CANCELLED"].includes(c.job?.status ?? ""),
      stageName: c.stage?.name ?? null,
      stageColor: c.stage?.color ?? null,
      stageKind: c.stage?.kind ?? null,
      reasons: c.reasons,
      blocker: linkBlocker(admissionId, linked.get(c.id) ?? null),
    }));

  return { ok: true, candidates, stages: hiringStages(stages) };
}

/** Posições da vaga da candidatura escolhida (para o RH decidir qual ocupar). */
export async function getLinkPositionPlan(
  admissionId: string,
  applicationId: string
): Promise<{ ok: true; plan: PositionPlan } | Fail> {
  const access = await requireAdmissionWrite();
  if (!access.ok) return { ok: false, error: "Não autorizado." };
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("jobId").eq("id", applicationId).maybeSingle();
  if (!app) return { ok: false, error: "Candidatura não encontrada." };
  const { data } = await supabase
    .from("job_positions")
    .select("id, positionNumber, status, applicationId, admissionId")
    .eq("jobId", (app as { jobId: string }).jobId);
  return { ok: true, plan: positionPlan(applicationId, admissionId, (data ?? []) as LinkPosition[]) };
}

export async function linkAdmissionCandidate(
  admissionId: string,
  input: { applicationId: string; stageId: string | null; positionId: string | null }
): Promise<{ ok: true; filled: string[]; warning: string | null } | Fail> {
  const access = await requireAdmissionWrite();
  if (!access.ok) return { ok: false, error: "Não autorizado." };
  const actorName = access.session.user.name ?? access.session.user.email ?? "Admin";
  const supabase = await createClient();

  const admission = await loadAdmission(supabase, admissionId);
  if (!admission) return { ok: false, error: "Admissão não encontrada." };
  if (admission.sourceApplicationId) {
    return { ok: false, error: "Esta admissão já está vinculada a uma candidatura. Desvincule antes de escolher outra." };
  }

  const { data: appRow } = await supabase.from("applications").select(CANDIDATE_COLUMNS).eq("id", input.applicationId).maybeSingle();
  const app = appRow as unknown as RawCandidate | null;
  if (!app) return { ok: false, error: "Candidatura não encontrada." };

  const { data: other } = await supabase
    .from("admissions")
    .select("id, fullName")
    .eq("sourceApplicationId", app.id)
    .is("deletedAt", null)
    .neq("id", admissionId)
    .limit(1)
    .maybeSingle();
  const blocker = linkBlocker(admissionId, (other as { id: string; fullName: string } | null) ?? null);
  if (blocker) return { ok: false, error: blocker };

  if (input.stageId && !hiringStages(await loadStages(supabase)).some((s) => s.id === input.stageId)) {
    return { ok: false, error: "Etapa inválida para contratação." };
  }

  const { data: positionRows } = await supabase
    .from("job_positions")
    .select("id, positionNumber, status, applicationId, admissionId")
    .eq("jobId", app.jobId);
  const plan = positionPlan(app.id, admissionId, (positionRows ?? []) as LinkPosition[]);
  if (input.positionId && !(plan.kind === "open" && plan.options.some((o) => o.id === input.positionId))) {
    return { ok: false, error: "Esta posição não está mais em aberto. Feche e abra o vínculo de novo." };
  }

  // Unificação: só o que está vazio na admissão. Compare-and-swap: ninguém vinculou antes.
  const fill = blankFieldsFromCandidate(admission, app);
  const { data: updated, error: linkError } = await supabase
    .from("admissions")
    .update({ sourceApplicationId: app.id, sourceJobId: app.jobId, ...fill, updatedById: access.userId })
    .eq("id", admissionId)
    .is("sourceApplicationId", null)
    .select("id");
  if (linkError || !updated?.length) {
    if (linkError) console.error("[candidate-link]", linkError.message);
    return { ok: false, error: linkError ? "Não foi possível vincular." : "A admissão foi vinculada por outra pessoa. Recarregue a página." };
  }

  let warning: string | null = null;
  let positionNumber: number | null = null;
  if (input.positionId) {
    const { error: fillError } = await supabase.rpc("job_position_fill", {
      p_position_id: input.positionId,
      p_application_id: app.id,
      p_admission_id: admissionId,
      p_expected_start: null,
      p_actor_user_id: access.userId,
      p_actor_name: actorName,
    });
    if (fillError) {
      // Sem posição não há vínculo pela metade: desfaz o que acabou de ser gravado.
      const revert = Object.fromEntries(Object.keys(fill).map((k) => [k, null]));
      await supabase
        .from("admissions")
        .update({ sourceApplicationId: null, sourceJobId: null, ...revert })
        .eq("id", admissionId)
        .eq("sourceApplicationId", app.id);
      return { ok: false, error: fillError.message || "Não foi possível ocupar a posição." };
    }
    positionNumber = plan.kind === "open" ? (plan.options.find((o) => o.id === input.positionId)?.positionNumber ?? null) : null;
  } else if (plan.kind === "occupied") {
    positionNumber = plan.positionNumber;
    if (plan.hasOtherAdmission) {
      warning = `A posição #${String(plan.positionNumber).padStart(2, "0")} da vaga continua apontando para outra admissão.`;
    } else {
      await supabase.from("job_positions").update({ admissionId }).eq("id", plan.positionId).is("admissionId", null);
    }
  }

  let stageName: string | null = null;
  if (input.stageId && input.stageId !== app.stageId) {
    // Sem automações de entrada: a admissão já existe (a automação abriria outra).
    const { error: stageError } = await supabase
      .from("applications")
      .update({ stageId: input.stageId, sort_order: null })
      .eq("id", app.id);
    if (stageError) {
      warning = "Vínculo feito, mas não foi possível mover o candidato de etapa.";
    } else {
      await supabase.from("application_stage_history").insert({ applicationId: app.id, stageId: input.stageId, changedBy: actorName });
      const { data: st } = await supabase.from("application_stages").select("name").eq("id", input.stageId).maybeSingle();
      stageName = (st as { name: string } | null)?.name ?? null;
    }
  }

  const filled = (Object.keys(fill) as FillableField[]).map((k) => FILLABLE_LABELS[k]);
  const jobLabel = app.job ? [app.job.code, app.job.title].filter(Boolean).join(" · ") : "vaga removida";
  await logActivity(supabase, {
    action: "CANDIDATE_LINKED",
    entity: "ADMISSION",
    entityId: admissionId,
    admissionId,
    userId: access.userId,
    description: `Vinculada à candidatura de ${app.fullName} (${jobLabel})`,
    metadata: {
      subjectName: admission.fullName,
      applicationId: app.id,
      jobId: app.jobId,
      filled,
      stageName,
      positionNumber,
    },
  });

  revalidateLink(admissionId, app.jobId);
  return { ok: true, filled, warning };
}

/**
 * Desfaz o vínculo (escolha errada). A etapa do candidato e a posição que ele ocupa na vaga
 * não mudam — só deixam de apontar para esta admissão. Liberar a posição é na página da vaga.
 */
export async function unlinkAdmissionCandidate(admissionId: string): Promise<{ ok: true } | Fail> {
  const access = await requireAdmissionWrite();
  if (!access.ok) return { ok: false, error: "Não autorizado." };
  const supabase = await createClient();

  const admission = await loadAdmission(supabase, admissionId);
  if (!admission) return { ok: false, error: "Admissão não encontrada." };
  if (!admission.sourceApplicationId) return { ok: false, error: "Esta admissão não está vinculada a nenhuma candidatura." };

  const { data: app } = await supabase
    .from("applications")
    .select("fullName, jobId")
    .eq("id", admission.sourceApplicationId)
    .maybeSingle();

  const { data: updated, error } = await supabase
    .from("admissions")
    .update({ sourceApplicationId: null, sourceJobId: null, updatedById: access.userId })
    .eq("id", admissionId)
    .eq("sourceApplicationId", admission.sourceApplicationId)
    .select("id");
  if (error || !updated?.length) {
    if (error) console.error("[candidate-unlink]", error.message);
    return { ok: false, error: "Não foi possível desvincular. Recarregue a página." };
  }
  await supabase.from("job_positions").update({ admissionId: null }).eq("admissionId", admissionId);

  const a = app as { fullName: string; jobId: string } | null;
  await logActivity(supabase, {
    action: "CANDIDATE_UNLINKED",
    entity: "ADMISSION",
    entityId: admissionId,
    admissionId,
    userId: access.userId,
    description: a ? `Desvinculada da candidatura de ${a.fullName}` : "Desvinculada da candidatura",
    metadata: { subjectName: admission.fullName, applicationId: admission.sourceApplicationId },
  });

  revalidateLink(admissionId, a?.jobId ?? null);
  return { ok: true };
}

function revalidateLink(admissionId: string, jobId: string | null) {
  revalidatePath("/admissoes");
  revalidatePath(`/admissoes/${admissionId}`);
  revalidatePath("/talentos");
  revalidatePath("/dashboard");
  if (jobId) {
    revalidatePath(`/vagas/${jobId}/candidatos`);
    revalidatePath(`/vagas/${jobId}/editar`);
    revalidatePath("/vagas/gerenciar");
  }
}
