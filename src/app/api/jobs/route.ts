import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Modality, ContractType, JobStatus } from "@prisma/client";

const jobSchema = z.object({
  title: z.string().min(2, "Título obrigatório"),
  department: z.string().optional(),
  company: z.string().optional(),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.string().length(2, "UF deve ter 2 caracteres"),
  modality: z.nativeEnum(Modality),
  contractType: z.nativeEnum(ContractType),
  description: z.string().min(10, "Descrição obrigatória"),
  responsibilities: z.string().min(10, "Responsabilidades obrigatórias"),
  requiredRequirements: z.string().min(10, "Requisitos obrigatórios são necessários"),
  desiredRequirements: z.string().optional(),
  benefits: z.string().optional(),
  workSchedule: z.string().optional(),
  salaryRange: z.string().optional(),
  openings: z.number().int().positive().optional(),
  highlightBenefit: z.string().optional(),
  closingDate: z.string().optional().nullable(),
  tallyFormUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  status: z.nativeEnum(JobStatus).default("ACTIVE"),
});

// GET /api/jobs — listar vagas (público: apenas ACTIVE; interno: todas)
export async function GET(req: NextRequest) {
  const session = await auth();
  const { searchParams } = new URL(req.url);

  const city = searchParams.get("city");
  const modality = searchParams.get("modality");
  const department = searchParams.get("department");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {};

  if (!session) {
    where.status = "ACTIVE";
  } else if (searchParams.get("status")) {
    where.status = searchParams.get("status");
  }

  if (city) where.city = { contains: city, mode: "insensitive" };
  if (modality) where.modality = modality;
  if (department) where.department = { contains: department, mode: "insensitive" };

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

// POST /api/jobs — criar vaga (somente ADMIN_RH)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = jobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { closingDate, tallyFormUrl, ...rest } = parsed.data;

  const job = await prisma.job.create({
    data: {
      ...rest,
      closingDate: typeof closingDate === "string" ? new Date(closingDate) : null,
      tallyFormUrl: tallyFormUrl || null,
    },
  });

  return NextResponse.json(job, { status: 201 });
}
