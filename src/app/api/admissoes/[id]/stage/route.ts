import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionWrite } from "@/lib/admissao/permissions";

// PATCH /api/admissoes/[id]/stage — move a admissão de etapa (usado no Kanban).
// Endpoint dedicado: o PATCH principal exige o objeto completo; aqui só a etapa.
const bodySchema = z.object({
  stageId: z.string().min(1).nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireAdmissionWrite();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Não autenticado" : "Não autorizado" },
      { status: access.status }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
  }
  const { stageId } = parsed.data;

  const supabase = await createClient();
  const { data: admission } = await supabase
    .from("admissions")
    .select("id")
    .eq("id", id)
    .is("deletedAt", null)
    .maybeSingle();
  if (!admission) {
    return NextResponse.json({ error: "Admissão não encontrada" }, { status: 404 });
  }

  // Valida a etapa alvo (quando não for "sem etapa") para erro limpo em vez de FK.
  if (stageId) {
    const { data: stage } = await supabase
      .from("admission_stages")
      .select("id")
      .eq("id", stageId)
      .maybeSingle();
    if (!stage) {
      return NextResponse.json({ error: "Etapa não encontrada" }, { status: 400 });
    }
  }

  await supabase
    .from("admissions")
    .update({ stageId, updatedById: access.userId })
    .eq("id", id);

  revalidatePath("/admissoes");
  revalidatePath("/admissoes/kanban");
  return NextResponse.json({ id, stageId }, { status: 200 });
}
