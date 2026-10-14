import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadAssessmentFile, validateAssessmentFile } from "@/lib/assessment-storage";
import { isTestMirror } from "@/lib/recruitment/evaluations/catalog";
import { buildEvaluationRow } from "@/lib/recruitment/evaluations/rows";
import { ASSESSMENT_COLUMNS, evaluationInputSchema, firstIssue } from "@/lib/recruitment/evaluations/schema";

// Avaliações da candidatura (hub da aba "Avaliações"): entrevista + parecer, referência,
// avaliação externa e a análise de IA. Testes online NÃO passam por aqui — a fonte é
// assessment_sessions. Internas: staff lê, ADMIN_RH escreve (também garantido pela RLS).

// GET — avaliações da candidatura (mais recentes primeiro) + quem está logado (o
// entrevistador da nova entrevista vem preenchido com ele).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("application_assessments")
    .select(ASSESSMENT_COLUMNS)
    .eq("applicationId", id)
    .order("occurredAt", { ascending: false, nullsFirst: false })
    .order("createdAt", { ascending: false });
  if (error) return NextResponse.json({ error: "Erro ao carregar as avaliações." }, { status: 500 });

  return NextResponse.json({
    // Cópias antigas de testes online ficam no banco, mas não aparecem (fonte única).
    assessments: (data ?? []).filter((a) => !isTestMirror(a)),
    currentUser: { id: session.user.id, name: session.user.name ?? session.user.email ?? "" },
  });
}

// POST — registra uma avaliação. JSON ({ ...campos }) ou multipart (campo `data` com o
// JSON + `attachment` opcional, só para avaliação externa).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  let payload: unknown;
  let file: File | null = null;
  try {
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      payload = JSON.parse(String(form.get("data") ?? "null"));
      const f = form.get("attachment");
      file = f instanceof File && f.size > 0 ? f : null;
    }
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = evaluationInputSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  if (file && parsed.data.kind !== "OTHER") {
    return NextResponse.json({ error: "Anexo só em avaliação externa." }, { status: 400 });
  }
  const built = buildEvaluationRow(parsed.data);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  const supabase = await createClient();
  const { data: application } = await supabase.from("applications").select("id, jobId").eq("id", id).maybeSingle();
  if (!application) return NextResponse.json({ error: "Candidatura não encontrada." }, { status: 404 });

  let attachment: { url: string; name: string } | null = null;
  if (file) {
    const check = validateAssessmentFile(file);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    try {
      attachment = await uploadAssessmentFile(file, id);
    } catch {
      return NextResponse.json({ error: "Não foi possível enviar o anexo." }, { status: 502 });
    }
  }

  const actorName = session.user.name ?? session.user.email ?? "RH";
  const { data: created, error } = await supabase
    .from("application_assessments")
    .insert({
      ...built.row,
      applicationId: id,
      source: "HUMAN",
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      createdBy: actorName,
      authorId: session.user.id,
    })
    .select(ASSESSMENT_COLUMNS)
    .single();
  if (error || !created) {
    return NextResponse.json({ error: "Não foi possível registrar a avaliação." }, { status: 500 });
  }

  // O card do pipeline mostra a contagem de avaliações e a próxima entrevista.
  if (application.jobId) revalidatePath(`/vagas/${application.jobId}/candidatos`);
  return NextResponse.json({ assessment: created }, { status: 201 });
}
