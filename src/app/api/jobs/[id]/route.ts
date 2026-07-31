import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { Modality, ContractType, JobStatus, JobPriority } from "@/types/domain";
import { generateSlug, isPublicJobStatus } from "@/lib/utils";

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
  salaryRange: z.string().optional().nullable(),
  openings: z.number().int().positive().optional().nullable(),
  highlightBenefit: z.string().optional().nullable(),
  responsible: z.string().optional().nullable(),
  closingDate: z.string().optional().nullable(),
  hiringDeadline: z.string().optional().nullable(),
  priority: z.nativeEnum(JobPriority).optional(),
  status: z.nativeEnum(JobStatus).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();

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

  const { closingDate, hiringDeadline, title, city, ...rest } = parsed.data;

  const supabase = await createClient();

  // Buscar estado atual para rastrear mudança de status e regenerar slug
  const { data: current } = await supabase
    .from("jobs")
    .select("title, city, status")
    .eq("id", id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });

  // Regenerar slug se título ou cidade mudaram (city pode ser null p/ banco de talentos)
  let slugUpdate: { slug: string } | undefined;
  if (title !== undefined || city !== undefined) {
    const newTitle = title ?? current.title;
    const newCity = city !== undefined ? city : (current.city as string | null);
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
    ...(title !== undefined ? { title } : {}),
    ...(city !== undefined ? { city } : {}),
    ...slugUpdate,
    // Colunas NOT NULL no banco: null do form (limpar legado) vira string vazia.
    ...(rest.responsibilities === null ? { responsibilities: "" } : {}),
    ...(rest.requiredRequirements === null ? { requiredRequirements: "" } : {}),
    ...(closingDate !== undefined
      ? { closingDate: closingDate ? new Date(closingDate).toISOString() : null }
      : {}),
    ...(hiringDeadline !== undefined
      ? { hiringDeadline: hiringDeadline ? new Date(hiringDeadline).toISOString() : null }
      : {}),
  };

  // Nada a atualizar: devolve o estado atual (evita update vazio no PostgREST).
  if (Object.keys(updateData).length === 0) {
    const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
    return NextResponse.json(job);
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
      changedBy: session.user.name ?? session.user.email ?? "Admin",
    });
  }

  revalidatePath("/");
  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");
  revalidatePath(`/vagas/${id}`);
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
  // job_status_history / applications caem por ON DELETE CASCADE (FK no schema).
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Erro ao excluir vaga" }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true });
}
