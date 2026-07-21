import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionAttachmentBlob } from "@/lib/admissao/storage";

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

  const supabase = await createClient();
  const { data: att } = await supabase
    .from("admission_attachments")
    .select("blobUrl, fileName")
    .eq("id", attachmentId)
    .eq("admissionId", id)
    .maybeSingle();
  if (!att) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  let blob: Blob | null;
  try {
    blob = await getAdmissionAttachmentBlob(att.blobUrl);
  } catch {
    return NextResponse.json({ error: "Falha ao acessar o anexo" }, { status: 502 });
  }

  if (!blob) {
    return NextResponse.json({ error: "Anexo indisponível" }, { status: 404 });
  }

  const fileName = (att.fileName ?? "anexo").replace(/["\r\n]/g, "");
  const contentType = blob.type || "application/octet-stream";

  return new NextResponse(blob.stream(), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
