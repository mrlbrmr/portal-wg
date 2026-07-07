import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Modality, ContractType, JobStatus, Prisma } from "@prisma/client";
import { generateSlug } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";

function richText(minChars: number, message: string) {
  return z
    .string()
    .refine((html) => html.replace(/<[^>]*>/g, "").trim().length >= minChars, message);
}

const jobSchema = z.object({
  title: z.string().min(2, "Título obrigatório"),
  department: z.string().optional(),
  company: z.string().optional(),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.string().length(2, "UF deve ter 2 caracteres"),
  modality: z.nativeEnum(Modality),
  contractType: z.nativeEnum(ContractType),
  description: richText(10, "Descrição obrigatória"),
  responsibilities: richText(10, "Responsabilidades obrigatórias"),
  requiredRequirements: richText(10, "Requisitos obrigatórios são necessários"),
  desiredRequirements: z.string().optional(),
  benefits: z.string().optional(),
  workSchedule: z.string().optional(),
  salaryRange: z.string().optional(),
  openings: z.number().int().positive().optional(),
  highlightBenefit: z.string().optional(),
  responsible: z.string().optional(),
  closingDate: z.string().optional().nullable(),
  hiringDeadline: z.string().optional().nullable(),
  tallyFormUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  status: z.nativeEnum(JobStatus).default("ACTIVE"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  const { searchParams } = new URL(req.url);

  const city = searchParams.get("city");
  const modality = searchParams.get("modality");
  const department = searchParams.get("department");
  const query = searchParams.get("query");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

  const now = new Date();

  const where: Prisma.JobWhereInput = {};

  if (!session) {
    // Portal público: só vagas ACTIVE e dentro do prazo
    where.status = "ACTIVE";
    where.OR = [
      { closingDate: null },
      { closingDate: { gte: now } },
    ];
  } else {
    const rawStatus = searchParams.get("status");
    if (rawStatus && Object.values(JobStatus).includes(rawStatus as JobStatus)) {
      where.status = rawStatus as JobStatus;
    }
  }

  if (city) where.city = { contains: city, mode: "insensitive" };
  if (modality && Object.values(Modality).includes(modality as Modality)) {
    where.modality = modality as Modality;
  }
  if (department) where.department = { contains: department, mode: "insensitive" };
  if (query) where.title = { contains: query, mode: "insensitive" };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.job.count({ where }),
  ]);

  return NextResponse.json({ jobs, total, page, limit });
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

  const { closingDate, hiringDeadline, tallyFormUrl, title, city, ...rest } = parsed.data;

  // Gerar slug único
  const baseSlug = generateSlug(title, city);
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.job.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++counter}`;
  }

  const job = await prisma.job.create({
    data: {
      title,
      city,
      ...rest,
      slug,
      closingDate: typeof closingDate === "string" && closingDate ? new Date(closingDate) : null,
      hiringDeadline: typeof hiringDeadline === "string" && hiringDeadline ? new Date(hiringDeadline) : null,
      tallyFormUrl: tallyFormUrl || null,
    },
  });

  await prisma.jobStatusHistory.create({
    data: { jobId: job.id, status: job.status, changedBy: session.user.name ?? session.user.email ?? "Sistema" },
  });

  revalidatePath("/");
  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");

  return NextResponse.json(job, { status: 201 });
}
