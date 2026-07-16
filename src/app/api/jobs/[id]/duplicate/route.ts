import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const original = await prisma.job.findUnique({
    where: { id },
    select: {
      title: true, department: true, company: true, city: true, state: true,
      modality: true, contractType: true, description: true, responsibilities: true,
      requiredRequirements: true, desiredRequirements: true, benefits: true,
      workSchedule: true, salaryRange: true, openings: true, highlightBenefit: true,
      responsible: true,
    },
  });
  if (!original) return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });

  const title = `${original.title} (Cópia)`;
  const baseSlug = generateSlug(title, original.city);
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.job.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++counter}`;
  }

  const newJob = await prisma.job.create({
    data: {
      ...original,
      title,
      slug,
      status: "DRAFT",
      closingDate: null,
      hiringDeadline: null,
    },
  });

  await prisma.jobStatusHistory.create({
    data: { jobId: newJob.id, status: "DRAFT", changedBy: session.user.name ?? "Admin" },
  });

  revalidatePath("/vagas/gerenciar");
  revalidatePath("/dashboard");

  return NextResponse.json(newJob, { status: 201 });
}
