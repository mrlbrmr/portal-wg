import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { Modality, ContractType, JobStatus, JobRequestReason, JobVisibility } from "@/types/domain";
import { generateSlug, isPublicJobStatus } from "@/lib/utils";
import { salaryColumns, salaryStateFromJob } from "@/lib/jobs/salary";
import { diffJobFields } from "@/lib/jobs/field-changes";
import { PUBLIC_JOB_COLUMNS } from "@/lib/jobs-query";

function richText(minChars: number, message: string) {
  return z
    .string()
    .refine((html) => html.replace(/<[^>]*>/g, "").trim().length >= minChars, message);
}

const updateJobSchema = z.object({
  title: z.string().min(2).optional(),
  department: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  isTalentPool: z.boolean().optional(),
  city: z.string().min(2).optional().nullable(),
  state: z.string().length(2).optional().nullable(),
  modality: z.nativeEnum(Modality).optional(),
  contractType: z.nativeEnum(ContractType).optional(),
  description: richText(10, "Descrição obrigatória").optional(),
  responsibilities: richText(10, "Responsabilidades obrigatórias").optional().nullable(),
  requiredRequirements: richText(10, "Requisitos obrigatórios são necessários").optional().nullable(),
  desiredRequirements: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),
  workSchedule: z.string().optional().nullable(),
  // Remuneração: modelo novo (salaryMode + salary + salaryPublic → salaryRange derivado).
  salaryMode: z.enum(["DEFINED", "TO_AGREE"]).optional(),
  salaryPublic: z.boolean().optional(),
  // Modelo antigo (salaryRange enviado direto) segue aceito para clientes antigos.
  salaryRange: z.string().optional().nullable(),
  salary: z.number().positive().optional().nullable(),
  /**
   * Aceito por compatibilidade e IGNORADO: o número de posições é derivado de
   * job_positions e só muda pelas ações "Adicionar posição" / "Cancelar posição".
   */
  openings: z.number().int().positive().optional().nullable(),
  highlightBenefit: z.string().optional().nullable(),
  responsible: z.string().optional().nullable(),
  hiringManager: z.string().optional().nullable(),
  openingReason: z.nativeEnum(JobRequestReason).optional().nullable(),
  closingDate: z.string().optional().nullable(),
  hiringDeadline: z.string().optional().nullable(),
  status: z.nativeEnum(JobStatus).optional(),
  visibility: z.nativeEnum(JobVisibility).optional(),
  /** Motivo informado ao alterar um dado do escopo aprovado (vai para o histórico). */
  changeReason: z.string().max(500).optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const supabase = await createClient();

  // Sem sessão: só colunas públicas (nada de salário interno, gestor ou escopo aprovado).
  const { data: jobRaw } = await supabase
    .from("jobs")
    .select(session ? "*" : PUBLIC_JOB_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  const job = jobRaw as unknown as { status: string } | null;

  if (!job) return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });

  if (!session && !isPublicJobStatus(job.status)) {
    return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = updateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    closingDate,
    hiringDeadline,
    title,
    city,
    openings: _ignoredOpenings,
    salaryMode,
    salaryPublic,
    salary,
    salaryRange,
    changeReason,
    ...rest
  } = parsed.data;
  void _ignoredOpenings;

  const supabase = await createClient();
  const actorName = session.user.name ?? session.user.email ?? "Admin";

  // Estado atual: status (histórico), slug, salário e os campos auditados.
  const { data: currentRaw } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!currentRaw) return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  const current = currentRaw as Record<string, unknown> & {
    title: string;
    city: string | null;
    status: string;
    isTalentPool: boolean;
    salary: number | string | null;
    salaryRange: string | null;
    salaryPublic: boolean | null;
  };

  // Vaga específica → banco de talentos: não pode haver contratado ocupando posição.
  const becomingTalentPool = rest.isTalentPool === true && !current.isTalentPool;
  const becomingSpecific = rest.isTalentPool === false && current.isTalentPool;
  if (becomingTalentPool) {
    const { count } = await supabase
      .from("job_positions")
      .select("id", { count: "exact", head: true })
      .eq("jobId", id)
      .eq("status", "FILLED");
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Esta vaga tem posições preenchidas e não pode virar banco de talentos." },
        { status: 409 }
      );
    }
  }

  // Remuneração → colunas (salaryRange é o texto público derivado).
  let salaryUpdate: Record<string, unknown> = {};
  if (salaryMode !== undefined) {
    const prev = salaryStateFromJob(current);
    salaryUpdate = { ...salaryColumns({
      mode: salaryMode,
      salary: salary ?? null,
      salaryPublic: salaryPublic ?? prev.salaryPublic,
      legacyText: prev.legacyText,
    }) };
  } else {
    if (salary !== undefined) salaryUpdate.salary = salary;
    if (salaryRange !== undefined) salaryUpdate.salaryRange = salaryRange;
    if (salaryPublic !== undefined) salaryUpdate.salaryPublic = salaryPublic;
  }

  // Regenerar slug se título ou cidade mudaram (city pode ser null p/ banco de talentos)
  let slugUpdate: { slug: string } | undefined;
  const titleChanged = title !== undefined && title !== current.title;
  const cityChanged = city !== undefined && city !== current.city;
  if (titleChanged || cityChanged) {
    const newTitle = title ?? current.title;
    const newCity = city !== undefined ? city : current.city;
    const baseSlug = generateSlug(newTitle, newCity);
    let slug = baseSlug;
    let counter = 1;
    for (;;) {
      const { data: dup } = await supabase
        .from("jobs")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .maybeSingle();
      if (!dup) break;
      slug = `${baseSlug}-${++counter}`;
    }
    slugUpdate = { slug };
  }

  const updateData: Record<string, unknown> = {
    ...rest,
    ...salaryUpdate,
    ...(title !== undefined ? { title } : {}),
    ...(city !== undefined ? { city } : {}),
    ...slugUpdate,
    // responsibilities e requiredRequirements são nullable desde 20260811000000.
    ...(closingDate !== undefined
      ? { closingDate: closingDate ? new Date(closingDate).toISOString() : null }
      : {}),
    ...(hiringDeadline !== undefined
      ? { hiringDeadline: hiringDeadline ? new Date(hiringDeadline).toISOString() : null }
      : {}),
  };

  // Nada a atualizar: devolve o estado atual (evita update vazio no PostgREST).
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(currentRaw);
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Erro ao atualizar vaga" }, { status: 500 });
  }

  // Registrar mudança de status no histórico
  if (parsed.data.status && parsed.data.status !== current.status) {
    await supabase.from("job_status_history").insert({
      jobId: id,
      status: parsed.data.status,
      changedBy: actorName,
    });
  }

  // Alterações relevantes de campos → um evento na linha do tempo da vaga.
  const changes = diffJobFields(current, updateData);
  if (changes.length > 0) {
    await supabase.from("job_events").insert({
      jobId: id,
      type: "FIELDS_UPDATED",
      reason: changeReason?.trim() || null,
      data: { changes },
      actorUserId: session.user.id,
      actorName,
    });
  }

  // Tipo de oportunidade: posições acompanham a mudança (nunca são apagadas).
  if (becomingTalentPool) {
    const { data: open } = await supabase
      .from("job_positions")
      .select("id, positionNumber")
      .eq("jobId", id)
      .eq("status", "OPEN");
    for (const p of (open ?? []) as Array<{ id: string; positionNumber: number }>) {
      await supabase
        .from("job_positions")
        .update({
          status: "CANCELLED",
          cancelledAt: new Date().toISOString(),
          cancelledBy: actorName,
          cancelReason: "Vaga convertida em banco de talentos",
        })
        .eq("id", p.id)
        .eq("status", "OPEN");
      await supabase.from("job_events").insert({
        jobId: id,
        positionId: p.id,
        type: "POSITION_CANCELLED",
        reason: "Vaga convertida em banco de talentos",
        data: { number: p.positionNumber },
        actorUserId: session.user.id,
        actorName,
      });
    }
  } else if (becomingSpecific) {
    const { count } = await supabase
      .from("job_positions")
      .select("id", { count: "exact", head: true })
      .eq("jobId", id)
      .neq("status", "CANCELLED");
    if ((count ?? 0) === 0) {
      await supabase.rpc("job_position_add", {
        p_job_id: id,
        p_reason: "Banco de talentos convertido em vaga específica",
        p_actor_user_id: session.user.id,
        p_actor_name: actorName,
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");
  revalidatePath(`/vagas/${id}`);
  revalidatePath(`/vagas/${id}/editar`);
  if (job.slug) revalidatePath(`/vagas/${job.slug}`);

  return NextResponse.json(job);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  // job_status_history / applications / job_positions / job_events caem por ON DELETE CASCADE.
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Erro ao excluir vaga" }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true });
}
