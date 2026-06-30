import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Modality, ContractType, JobStatus } from "@prisma/client";

const updateJobSchema = z.object({
  title: z.string().min(2).optional(),
  department: z.string().optional(),
  city: z.string().min(2).optional(),
  state: z.string().length(2).optional(),
  modality: z.nativeEnum(Modality).optional(),
  contractType: z.nativeEnum(ContractType).optional(),
  description: z.string().min(10).optional(),
  responsibilities: z.string().min(10).optional(),
  requiredRequirements: z.string().min(10).optional(),
  desiredRequirements: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),
  workSchedule: z.string().optional().nullable(),
  closingDate: z.string().optional().nullable(),
  tallyFormUrl: z.string().url("URL inválida").optional().nullable().or(z.literal("")),
  status: z.nativeEnum(JobStatus).optional(),
});

// GET /api/jobs/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  const job = await prisma.job.findUnique({ where: { id } });

  if (!job) return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });

  if (!session && job.status !== "ACTIVE") {
    return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  }

  return NextResponse.json(job);
}

// PATCH /api/jobs/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { closingDate, tallyFormUrl, ...rest } = parsed.data;

  const job = await prisma.job.update({
    where: { id },
    data: {
      ...rest,
      ...(closingDate !== undefined
        ? { closingDate: typeof closingDate === "string" ? new Date(closingDate) : null }
        : {}),
      ...(tallyFormUrl !== undefined
        ? { tallyFormUrl: tallyFormUrl || null }
        : {}),
    },
  });

  return NextResponse.json(job);
}

// DELETE /api/jobs/[id]
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
  return NextResponse.json({ success: true });
}
