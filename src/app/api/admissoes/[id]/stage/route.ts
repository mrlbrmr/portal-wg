import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmissionWrite } from "@/lib/admissao/permissions";

// PATCH /api/admissoes/[id]/stage — move a admissão de etapa (usado no Kanban).
// Endpoint dedicado: o PATCH principal exige o objeto completo; aqui só a etapa.
const bodySchema = z.object({
  stageId: z.string().min(1).nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireAdmissionWrite();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Não autenticado" : "Não autorizado" },
      { status: access.status }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
  }
  const { stageId } = parsed.data;

  const admission = await prisma.admission.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!admission) {
    return NextResponse.json({ error: "Admissão não encontrada" }, { status: 404 });
  }

  // Valida a etapa alvo (quando não for "sem etapa") para erro limpo em vez de FK.
  if (stageId) {
    const stage = await prisma.admissionStage.findUnique({ where: { id: stageId }, select: { id: true } });
    if (!stage) {
      return NextResponse.json({ error: "Etapa não encontrada" }, { status: 400 });
    }
  }

  await prisma.admission.update({
    where: { id },
    data: { stageId, updatedById: access.userId },
  });

  revalidatePath("/admissoes");
  revalidatePath("/admissoes/kanban");
  return NextResponse.json({ id, stageId }, { status: 200 });
}
