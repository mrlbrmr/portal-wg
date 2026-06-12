import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteResume } from "@/lib/file-storage";
import { logAudit } from "@/lib/audit";

// POST /api/candidates/[id]/anonymize — anonimizar candidato (LGPD)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { applications: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidato não encontrado" }, { status: 404 });
  }

  if (candidate.anonymized) {
    return NextResponse.json({ error: "Candidato já foi anonimizado" }, { status: 400 });
  }

  // Deletar arquivos de currículo
  for (const app of candidate.applications) {
    await deleteResume(app.resumeFilePath).catch(console.error);
    // Apagar caminho do arquivo no banco
    await prisma.application.update({
      where: { id: app.id },
      data: { resumeFilePath: "[anonimizado]", resumeFileName: "[anonimizado]" },
    });
  }

  // Anonimizar dados pessoais (não deleta para manter integridade de audit logs)
  await prisma.candidate.update({
    where: { id },
    data: {
      fullName: "[Anonimizado]",
      email: `anonimizado-${id}@removido.lgpd`,
      phone: "[Removido]",
      city: "[Removido]",
      state: "--",
      notes: null,
      anonymized: true,
      anonymizedAt: new Date(),
    },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "CANDIDATE_ANONYMIZED",
    entityType: "candidate",
    entityId: id,
    metadata: { reason: "Solicitação LGPD" },
  });

  return NextResponse.json({ message: "Candidato anonimizado com sucesso." });
}
