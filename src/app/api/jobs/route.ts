import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { Modality, ContractType, JobStatus, JobRequestReason, JobVisibility } from "@/types/domain";
import { generateSlug } from "@/lib/utils";
import { applyJobFilters, onlyPublicVisible, PUBLIC_JOB_COLUMNS } from "@/lib/jobs-query";
import { rateLimit } from "@/lib/rate-limit";
import { salaryColumns } from "@/lib/jobs/salary";

function richText(minChars: number, message: string) {
  return z
    .string()
    .refine((html) => html.replace(/<[^>]*>/g, "").trim().length >= minChars, message);
}

const jobSchema = z
  .object({
  title: z.string().min(2, "Título obrigatório"),
  department: z.string().optional(),
  company: z.string().optional(),
  isTalentPool: z.boolean().optional().default(false),
  city: z.string().min(2, "Cidade obrigatória").optional().nullable(),
  state: z.string().length(2, "UF deve ter 2 caracteres").optional().nullable(),
  modality: z.nativeEnum(Modality),
  contractType: z.nativeEnum(ContractType),
  description: richText(10, "Descrição obrigatória"),
  responsibilities: z.string().optional().nullable(),
  requiredRequirements: z.string().optional().nullable(),
  desiredRequirements: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),
  workSchedule: z.string().optional(),
  salaryRange: z.string().optional(),
  salary: z.number().positive().optional().nullable(),
  // Remuneração no modelo novo (salaryRange passa a ser derivado — ver src/lib/jobs/salary.ts).
  salaryMode: z.enum(["DEFINED", "TO_AGREE"]).optional(),
  salaryPublic: z.boolean().optional(),
  /** Número de posições com que a vaga nasce (#01..#N, criadas por trigger no banco). */
  openings: z.number().int().positive().max(999).optional(),
  highlightBenefit: z.string().optional(),
  responsible: z.string().optional(),
  hiringManager: z.string().optional(),
  openingReason: z.nativeEnum(JobRequestReason).optional().nullable(),
  closingDate: z.string().optional().nullable(),
  hiringDeadline: z.string().optional().nullable(),
  status: z.nativeEnum(JobStatus).default("ACTIVE"),
  /** Onde a vaga aparece (Portal, Intranet ou os dois). Sem o campo, o banco usa BOTH. */
  visibility: z.nativeEnum(JobVisibility).optional(),
})
.superRefine((data, ctx) => {
  if (!data.isTalentPool) {
    if (!data.city || data.city.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["city"], message: "Cidade obrigatória" });
    }
    if (!data.state || data.state.length !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["state"], message: "UF deve ter 2 caracteres" });
    }
  }
});

export async function GET(req: NextRequest) {
  const session = await auth();
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  const city = searchParams.get("city");
  const modality = searchParams.get("modality");
  const department = searchParams.get("department");
  const query = searchParams.get("query");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;

  // Público recebe só as colunas públicas; o painel (sessão) recebe a linha inteira.
  let q = supabase.from("jobs").select(session ? "*" : PUBLIC_JOB_COLUMNS, { count: "exact" });

  if (!session) {
    // Portal público: status "aberto" (ACTIVE/Triagem/Entrevistas/Admissão) e no prazo.
    // (RLS também garante isso para a chave anon; filtro explícito preserva o prazo.)
    q = onlyPublicVisible(q);
  } else {
    const rawStatus = searchParams.get("status");
    if (rawStatus && Object.values(JobStatus).includes(rawStatus as JobStatus)) {
      q = q.eq("status", rawStatus);
    }
  }

  q = applyJobFilters(q, {
    city,
    modality: modality && Object.values(Modality).includes(modality as Modality) ? modality : null,
    department,
    query,
  });

  const { data, count, error } = await q
    .order("createdAt", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Erro ao listar vagas" }, { status: 500 });
  }

  return NextResponse.json({ jobs: data ?? [], total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfter } = rateLimit(ip, { limit: 30, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

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

  const parsed = jobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { closingDate, hiringDeadline, title, city = null, salaryMode, salaryPublic, ...rest } = parsed.data;
  if (salaryMode !== undefined) {
    Object.assign(
      rest,
      salaryColumns({ mode: salaryMode, salary: rest.salary ?? null, salaryPublic: salaryPublic ?? true, legacyText: null })
    );
  } else if (salaryPublic !== undefined) {
    Object.assign(rest, { salaryPublic });
  }
  // Banco de talentos não tem posições.
  if (rest.isTalentPool) delete rest.openings;

  const supabase = await createClient();

  // Gerar slug único (checa colisão no banco); city é null p/ banco de talentos
  const baseSlug = generateSlug(title, city);
  let slug = baseSlug;
  let counter = 1;
  for (;;) {
    const { data: existing } = await supabase.from("jobs").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${++counter}`;
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      title,
      city,
      ...rest,
      slug,
      closingDate: closingDate ? new Date(closingDate).toISOString() : null,
      hiringDeadline: hiringDeadline ? new Date(hiringDeadline).toISOString() : null,
    })
    .select()
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Erro ao criar vaga" }, { status: 500 });
  }

  const actorName = session.user.name ?? session.user.email ?? "Sistema";
  await Promise.all([
    supabase.from("job_status_history").insert({ jobId: job.id, status: job.status, changedBy: actorName }),
    supabase.from("job_events").insert({
      jobId: job.id,
      type: "JOB_CREATED",
      data: { source: "manual", positions: job.isTalentPool ? null : job.openings },
      actorUserId: session.user.id,
      actorName,
    }),
  ]);

  // O vínculo solicitação ↔ vaga NÃO é fechado aqui: a vaga originada de uma solicitação
  // nasce dentro de create_job_from_request() (transacional), que já grava os dois lados.
  // Esta rota só cria vagas avulsas (banco de talentos e afins).

  revalidatePath("/");
  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");

  return NextResponse.json(job, { status: 201 });
}
