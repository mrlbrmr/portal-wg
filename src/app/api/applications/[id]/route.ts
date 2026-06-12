import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";

const statusUpdateSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  note: z.string().max(500).optional(),
});

// GET /api/applications/[id] — detalhes da candidatura (interno)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      candidate: true,
      job: true,
      aiReview: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  return NextResponse.json(application);
}

// PATCH /api/applications/[id] — alterar status (interno)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Visualizadores não podem alterar status
  if (session.user.role === "VIEWER_RH") {
    return NextResponse.json({ error: "Sem permissão para alterar status" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const current = await prisma.application.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!current) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  const [application] = await prisma.$transaction([
    prisma.application.update({
      where: { id },
      data: { status: parsed.data.status },
    }),
    prisma.statusHistory.create({
      data: {
        applicationId: id,
        fromStatus: current.status,
        toStatus: parsed.data.status,
        changedById: session.user.id,
        changedByName: session.user.name ?? undefined,
        note: parsed.data.note,
      },
    }),
  ]);

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "APPLICATION_STATUS_CHANGED",
    entityType: "application",
    entityId: id,
    metadata: { from: current.status, to: parsed.data.status },
  });

  return NextResponse.json(application);
}
