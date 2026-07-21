import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteAssessmentFile } from "@/lib/assessment-storage";

// Exclusão de uma avaliação (admin). Remove o anexo do storage se houver.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> }
) {
  const { id, assessmentId } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: assessment } = await supabase
    .from("application_assessments")
    .select("id, attachmentUrl")
    .eq("id", assessmentId)
    .eq("applicationId", id)
    .maybeSingle();
  if (!assessment) {
    return NextResponse.json({ error: "Avaliação não encontrada" }, { status: 404 });
  }

  if (assessment.attachmentUrl) {
    try {
      await deleteAssessmentFile(assessment.attachmentUrl);
    } catch {
      // Se o objeto já não existir, segue com a exclusão do registro.
    }
  }

  await supabase.from("application_assessments").delete().eq("id", assessmentId);

  return NextResponse.json({ ok: true });
}
