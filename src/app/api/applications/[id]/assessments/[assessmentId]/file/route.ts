import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAssessmentFileBlob } from "@/lib/assessment-storage";

// Download do anexo de uma avaliação — SOMENTE staff autenticado (LGPD:
// bucket privado, entregue server-side, URL do objeto nunca exposta).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> }
) {
  const { id, assessmentId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const supabase = await createClient();
  const { data: assessment } = await supabase
    .from("application_assessments")
    .select("attachmentUrl, attachmentName")
    .eq("id", assessmentId)
    .eq("applicationId", id)
    .maybeSingle();
  if (!assessment?.attachmentUrl) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  let blob: Blob | null;
  try {
    blob = await getAssessmentFileBlob(assessment.attachmentUrl);
  } catch {
    return NextResponse.json({ error: "Falha ao acessar o anexo" }, { status: 502 });
  }
  if (!blob) return NextResponse.json({ error: "Anexo indisponível" }, { status: 404 });

  const fileName = (assessment.attachmentName ?? "anexo").replace(/["\r\n]/g, "");
  return new NextResponse(blob.stream(), {
    status: 200,
    headers: {
      "Content-Type": blob.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
