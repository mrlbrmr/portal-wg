import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResumeStream } from "@/lib/storage";

// Download do currículo — SOMENTE para RH autenticado.
// LGPD: o currículo fica em Blob privado; esta rota o entrega server-side,
// sem nunca expor a URL do blob ao cliente.

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
    select: { resumeUrl: true, resumeName: true },
  });
  if (!application?.resumeUrl) {
    return NextResponse.json({ error: "Currículo não encontrado" }, { status: 404 });
  }

  let result;
  try {
    result = await getResumeStream(application.resumeUrl);
  } catch {
    return NextResponse.json({ error: "Falha ao acessar o currículo" }, { status: 502 });
  }

  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json({ error: "Currículo indisponível" }, { status: 404 });
  }

  const fileName = (application.resumeName ?? "curriculo").replace(/["\r\n]/g, "");
  const contentType = result.blob.contentType || "application/octet-stream";

  return new NextResponse(result.stream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
