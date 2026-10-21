import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionWrite } from "@/lib/admissao/permissions";
import { formAnswersSchema, answersToRow } from "@/lib/admissao/form-answers";
import { advanceToDocumentIntake } from "@/lib/admissao/advance-document-intake";
import { logActivity } from "@/lib/activity/log";

// PUT /api/admissoes/[id]/digital/answers — o RH preenche (ou corrige) as respostas do
// formulário em nome do candidato, p.ex. quando os documentos chegam por WhatsApp.
// Se o candidato ainda não enviou, o formulário passa a "Concluído" (sem e-mail ao RH: foi
// o próprio RH quem preencheu) e o link anterior deixa de aceitar envio.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireAdmissionWrite();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "Não autenticado" : "Não autorizado" }, { status: access.status });
  }

  const supabase = await createClient();
  const { data: admission } = await supabase
    .from("admissions")
    .select("id, fullName, digitalFormSubmittedAt")
    .eq("id", id)
    .is("deletedAt", null)
    .maybeSingle();
  if (!admission) return NextResponse.json({ error: "Admissão não encontrada" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }
  const parsed = formAnswersSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const firstFill = !admission.digitalFormSubmittedAt;
  let update = supabase
    .from("admissions")
    .update({
      ...answersToRow(parsed.data),
      ...(firstFill ? { digitalFormSubmittedAt: new Date().toISOString() } : {}),
      updatedById: access.userId,
    })
    .eq("id", id);
  // compare-and-swap: se o candidato enviou enquanto o RH digitava, não sobrescreve o "concluído"
  if (firstFill) update = update.is("digitalFormSubmittedAt", null);
  const { data: rows, error } = await update.select("id");
  if (error) {
    console.error("[admissoes answers PUT]", error.message);
    return NextResponse.json({ error: "Não foi possível salvar as respostas." }, { status: 500 });
  }
  if (!rows?.length) {
    return NextResponse.json({ error: "O formulário mudou enquanto você editava. Recarregue a página." }, { status: 409 });
  }

  await logActivity(supabase, {
    action: firstFill ? "FORM_FILLED_BY_HR" : "ADMISSION_UPDATED",
    entity: "ADMISSION",
    entityId: id,
    admissionId: id,
    userId: access.userId,
    description: firstFill ? "Formulário preenchido pelo RH (documentos recebidos fora do link)" : "Respostas do formulário corrigidas pelo RH",
    metadata: { subjectName: admission.fullName as string },
  });
  if (firstFill) await advanceToDocumentIntake(supabase, id, "submit");

  revalidatePath("/admissoes");
  revalidatePath(`/admissoes/${id}`);
  return NextResponse.json({ ok: true });
}
