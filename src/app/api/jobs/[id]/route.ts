import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Modality, ContractType, JobStatus, ApplyMode } from "@prisma/client";
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
  city: z.string().min(2).optional(),
  state: z.string().length(2).optional(),
  modality: z.nativeEnum(Modality).optional(),
  contractType: z.nativeEnum(ContractType).optional(),
  description: richText(10, "Descrição obrigatória").optional(),
  responsibilities: richText(10, "Responsabilidades obrigatórias").optional(),
  requiredRequirements: richText(10, "Requisitos obrigatórios são necessários").optional(),
  desiredRequirements: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),
  workSchedule: z.string().optional().nullable(),
  salaryRange: z.string().optional().nullable(),
  openings: z.number().int().positive().optional().nullable(),
  highlightBenefit: z.string().optional().nullable(),
  responsible: z.string().optional().nullable(),
  closingDate: z.string().optional().nullable(),
  hiringDeadline: z.string().optional().nullable(),
  tallyFormUrl: z.string().url("URL inválida").optional().nullable().or(z.literal("")),
  applyMode: z.nativeEnum(ApplyMode).optional(),
  status: z.nativeEnum(JobStatus).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  const job = await prisma.job.findUnique({ where: { id } });

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

  const { closingDate, hiringDeadline, tallyFormUrl, title, city, ...rest } = parsed.data;

  // Buscar estado atual para rastrear mudança de status e regenerar slug
  const current = await prisma.job.findUnique({
    where: { id },
    select: { title: true, city: true, status: true },
  });
  if (!current) return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });

  // Regenerar slug se título ou cidade mudaram
  let slugUpdate: { slug: string } | undefined;
  if (title || city) {
    const newTitle = title ?? current.title;
    const newCity = city ?? current.city;
    const baseSlug = generateSlug(newTitle, newCity);
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.job.findFirst({ where: { slug, NOT: { id } } })) {
      slug = `${baseSlug}-${++counter}`;
    }
    slugUpdate = { slug };
  }

  const job = await prisma.job.update({
    where: { id },
    data: {
      ...rest,
      ...(title ? { title } : {}),
      ...(city ? { city } : {}),
      ...slugUpdate,
      ...(closingDate !== undefined
        ? { closingDate: typeof closingDate === "string" && closingDate ? new Date(closingDate) : null }
        : {}),
      ...(hiringDeadline !== undefined
        ? { hiringDeadline: typeof hiringDeadline === "string" && hiringDeadline ? new Date(hiringDeadline) : null }
        : {}),
      ...(tallyFormUrl !== undefined
        ? { tallyFormUrl: tallyFormUrl || null }
        : {}),
    },
  });

  // Registrar mudança de status no histórico
  if (parsed.data.status && parsed.data.status !== current.status) {
    await prisma.jobStatusHistory.create({
      data: {
        jobId: id,
        status: parsed.data.status,
        changedBy: session.user.name ?? session.user.email ?? "Admin",
      },
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

  await prisma.job.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true });
}
