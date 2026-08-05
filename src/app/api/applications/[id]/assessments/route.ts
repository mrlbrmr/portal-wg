import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { assessmentInputSchema } from "@/lib/assessment-schema";
import { uploadAssessmentFile, validateAssessmentFile } from "@/lib/assessment-storage";

// Avaliações de um candidato (entrevistas/testes). Internas: staff lê, admin escreve.

// GET — lista as avaliações (mais recentes primeiro).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("application_assessments")
    .select(
      "id, kind, source, title, score, outcome, summary, evaluator, attachmentName, occurredAt, createdAt, createdBy"
    )
    .eq("applicationId", id)
    .order("occurredAt", { ascending: false, nullsFirst: false })
    .order("createdAt", { ascending: false });

  return NextResponse.json({ assessments: data ?? [] });
}

// POST — cria uma avaliação manual (multipart: campos + anexo opcional).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = assessmentInputSchema.safeParse({
    kind: form.get("kind"),
    title: form.get("title") || null,
    score: form.get("score") || null,
    outcome: form.get("outcome") || null,
    summary: form.get("summary") || null,
    evaluator: form.get("evaluator") || null,
    occurredAt: form.get("occurredAt") || null,
  });
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();

  // A candidatura precisa existir.
  const { data: application } = await supabase
    .from("applications")
    .select("id, jobId")
    .eq("id", id)
    .maybeSingle();
  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada." }, { status: 404 });
  }

  // Anexo opcional.
  let attachment: { url: string; name: string } | null = null;
  const file = form.get("attachment");
  if (file instanceof File && file.size > 0) {
    const check = validateAssessmentFile(file);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    try {
      attachment = await uploadAssessmentFile(file, id);
    } catch {
      return NextResponse.json({ error: "Não foi possível enviar o anexo." }, { status: 502 });
    }
  }

  const { kind, title, score, outcome, summary, evaluator, occurredAt } = parsed.data;
  // Data só-dia (yyyy-mm-dd) vira meio-dia UTC para não "voltar um dia" no fuso BRT.
  const normalizedOccurredAt = occurredAt
    ? /^\d{4}-\d{2}-\d{2}$/.test(occurredAt)
      ? `${occurredAt}T12:00:00Z`
      : occurredAt
    : null;
  const { error } = await supabase.from("application_assessments").insert({
    applicationId: id,
    kind,
    source: "HUMAN",
    title: title || null,
    score: score ?? null,
    outcome: outcome || null,
    summary: summary || null,
    evaluator: evaluator || session.user.name || session.user.email || "RH",
    attachmentUrl: attachment?.url ?? null,
    attachmentName: attachment?.name ?? null,
    occurredAt: normalizedOccurredAt,
    createdBy: session.user.name ?? session.user.email ?? "RH",
  });
  if (error) {
    return NextResponse.json({ error: "Não foi possível registrar a avaliação." }, { status: 500 });
  }

  if (application.jobId) revalidatePath(`/vagas/${application.jobId}/candidatos`);
  return NextResponse.json({ ok: true }, { status: 201 });
}
