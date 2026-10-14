import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteAssessmentFile } from "@/lib/assessment-storage";
import { evaluationGroup, isTestMirror } from "@/lib/recruitment/evaluations/catalog";
import { buildEvaluationRow } from "@/lib/recruitment/evaluations/rows";
import { ASSESSMENT_COLUMNS, evaluationPatchSchema, firstIssue } from "@/lib/recruitment/evaluations/schema";

type Params = { params: Promise<{ id: string; assessmentId: string }> };

// Grupo do hub ↔ kind aceito na edição: o tipo do registro nunca muda (uma entrevista
// continua entrevista). Teste manual antigo (feito fora do Portal) é editado como externa.
const KIND_BY_GROUP: Record<string, string> = { interview: "INTERVIEW", reference: "REFERENCE", external: "OTHER" };

// PATCH — edita uma avaliação registrada por pessoa (admin). Autor, criação e candidatura
// são preservados (trigger no banco); quem editou fica em updatedBy*. Com
// `expectedUpdatedAt`, recusa (409) se alguém salvou antes.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, assessmentId } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const parsed = evaluationPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("application_assessments")
    .select("id, kind, source, evaluator, metadata, application:applications(jobId)")
    .eq("id", assessmentId)
    .eq("applicationId", id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });
  if (isTestMirror(current) || KIND_BY_GROUP[evaluationGroup(current)] !== parsed.data.data.kind) {
    return NextResponse.json({ error: "Esta avaliação não pode ser editada por aqui." }, { status: 400 });
  }

  const built = buildEvaluationRow(parsed.data.data);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  let query = supabase
    .from("application_assessments")
    .update({
      ...built.row,
      updatedById: session.user.id,
      updatedByName: session.user.name ?? session.user.email ?? "RH",
    })
    .eq("id", assessmentId)
    .eq("applicationId", id);
  if (parsed.data.expectedUpdatedAt) query = query.eq("updatedAt", parsed.data.expectedUpdatedAt);
  const { data: updated, error } = await query.select(ASSESSMENT_COLUMNS).maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível salvar a avaliação." }, { status: 500 });
  if (!updated) {
    return NextResponse.json(
      { error: "Esta avaliação foi alterada por outra pessoa enquanto você editava. Recarregue para ver a versão atual." },
      { status: 409 }
    );
  }

  const jobId = (current.application as { jobId?: string } | null)?.jobId;
  if (jobId) revalidatePath(`/vagas/${jobId}/candidatos`);
  return NextResponse.json({ assessment: updated });
}

// DELETE — exclui uma avaliação (admin). Remove o anexo do storage se houver.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, assessmentId } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: assessment } = await supabase
    .from("application_assessments")
    .select("id, attachmentUrl, application:applications(jobId)")
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

  const { error } = await supabase.from("application_assessments").delete().eq("id", assessmentId).eq("applicationId", id);
  if (error) return NextResponse.json({ error: "Não foi possível excluir a avaliação." }, { status: 500 });

  const jobId = (assessment.application as { jobId?: string } | null)?.jobId;
  if (jobId) revalidatePath(`/vagas/${jobId}/candidatos`);
  return NextResponse.json({ ok: true });
}
