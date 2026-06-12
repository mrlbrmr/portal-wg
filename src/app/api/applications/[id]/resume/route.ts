import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResumeBuffer } from "@/lib/file-storage";
import { logAudit } from "@/lib/audit";
import path from "path";

// GET /api/applications/[id]/resume — download do currículo (somente autenticado)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const application = await prisma.application.findUnique({
    where: { id },
    select: { resumeFilePath: true, resumeFileName: true },
  });

  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  if (application.resumeFilePath === "[anonimizado]") {
    return NextResponse.json({ error: "Arquivo removido (candidato anonimizado)" }, { status: 410 });
  }

  let buffer: Buffer;
  try {
    buffer = await getResumeBuffer(application.resumeFilePath);
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  // Determinar Content-Type pelo filename
  const ext = path.extname(application.resumeFileName).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "RESUME_DOWNLOADED",
    entityType: "application",
    entityId: id,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentTypeMap[ext] || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${application.resumeFileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
