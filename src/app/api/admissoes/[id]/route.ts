import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { admissionSchema } from "@/lib/admissao/validation";
import { admissionInputToData } from "@/lib/admissao/data";
import {
  requireAdmissionWrite,
  requireAdmissionSession,
  canDeleteAdmission,
} from "@/lib/admissao/permissions";

// PATCH /api/admissoes/[id] — edita uma admissão. Escrita = ADMIN_RH.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireAdmissionWrite();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Não autenticado" : "Não autorizado" },
      { status: access.status }
    );
  }

  const existing = await prisma.admission.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Admissão não encontrada" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = admissionSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Dados inválidos" }, { status: 400 });
  }

  await prisma.admission.update({
    where: { id },
    data: { ...admissionInputToData(parsed.data), updatedById: access.userId },
  });

  revalidatePath("/admissoes");
  revalidatePath(`/admissoes/${id}/editar`);
  return NextResponse.json({ id }, { status: 200 });
}

// DELETE /api/admissoes/[id] — soft-delete. Exclusão = ADMIN_RH.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireAdmissionSession();
  if (!access.ok) {
    return NextResponse.json({ error: "Não autenticado" }, { status: access.status });
  }
  if (!canDeleteAdmission(access.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const existing = await prisma.admission.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Admissão não encontrada" }, { status: 404 });
  }

  await prisma.admission.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: access.userId },
  });

  revalidatePath("/admissoes");
  return NextResponse.json({ ok: true }, { status: 200 });
}
