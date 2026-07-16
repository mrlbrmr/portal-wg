import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ApplicationStage } from "@prisma/client";
import { deleteResume } from "@/lib/storage";

// Rotas internas — leitura/mutação de candidatura.
// LGPD: nenhuma dessas rotas é pública (protegidas por auth + middleware).

// GET: ficha completa da candidatura + histórico de etapas. Qualquer usuário
// interno autenticado pode ver; só ADMIN_RH altera (PATCH/DELETE).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const application = await prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      resumeName: true,
      stage: true,
      notes: true,
      createdAt: true,
      stageHistory: {
        orderBy: { changedAt: "asc" },
        select: { id: true, stage: true, changedBy: true, changedAt: true },
      },
    },
  });
  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  return NextResponse.json(application);
}

const patchSchema = z.object({
  stage: z.nativeEnum(ApplicationStage).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

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
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const current = await prisma.application.findUnique({
    where: { id },
    select: { id: true, jobId: true, stage: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  const data: { stage?: ApplicationStage; notes?: string | null } = {};
  if (parsed.data.stage !== undefined) data.stage = parsed.data.stage;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  const application = await prisma.application.update({
    where: { id },
    data,
    select: { id: true, stage: true, jobId: true, notes: true },
  });

  // Só registra no histórico quando a etapa realmente muda.
  if (parsed.data.stage && parsed.data.stage !== current.stage) {
    await prisma.applicationStageHistory.create({
      data: {
        applicationId: id,
        stage: parsed.data.stage,
        changedBy: session.user.name ?? session.user.email ?? "Admin",
      },
    });
  }

  revalidatePath(`/vagas/${application.jobId}/candidatos`);
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, stage: application.stage, notes: application.notes });
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

  const application = await prisma.application.findUnique({
    where: { id },
    select: { id: true, jobId: true, resumeUrl: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  // Remove o currículo do storage privado (retenção LGPD).
  if (application.resumeUrl) {
    try {
      await deleteResume(application.resumeUrl);
    } catch {
      // Se o blob já não existir, segue com a exclusão do registro.
    }
  }

  await prisma.application.delete({ where: { id } });

  revalidatePath(`/vagas/${application.jobId}/candidatos`);
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true });
}
