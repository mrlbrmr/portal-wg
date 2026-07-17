import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdmissionAttachmentStream } from "@/lib/admissao/storage";

// Download de anexo de admissão — SOMENTE para interno autenticado (leitura).
// O arquivo fica em Blob privado; entregue server-side, sem expor a URL bruta.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const att = await prisma.admissionAttachment.findFirst({
    where: { id: attachmentId, admissionId: id },
    select: { blobUrl: true, fileName: true },
  });
  if (!att) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  let result;
  try {
    result = await getAdmissionAttachmentStream(att.blobUrl);
  } catch {
    return NextResponse.json({ error: "Falha ao acessar o anexo" }, { status: 502 });
  }

  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json({ error: "Anexo indisponível" }, { status: 404 });
  }

  const fileName = (att.fileName ?? "anexo").replace(/["\r\n]/g, "");
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
