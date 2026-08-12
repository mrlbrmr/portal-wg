import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { deleteResume } from "@/lib/storage";

// Rotas internas — leitura/mutação de candidatura.
// LGPD: nenhuma dessas rotas é pública (protegidas por auth + middleware).

// GET: ficha completa da candidatura + histórico de etapas. Qualquer usuário
// interno autenticado pode ver; só ADMIN_RH altera (PATCH/DELETE).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("applications")
    .select(
      "id, fullName, email, phone, resumeName, stageId, stage:application_stages(id, name, color), source, addedBy, notes, createdAt, country, candidateCity, availablePresential, salaryExpectation, stageHistory:application_stage_history(id, stageId, stage:application_stages(name, color), changedBy, changedAt)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  // Ordena o histórico (o embed do PostgREST não garante ordem).
  const stageHistory = ((application.stageHistory ?? []) as Array<{ changedAt: string }>).sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  );

  return NextResponse.json({ ...application, stageHistory });
}

const patchSchema = z.object({
  stageId: z.string().min(1).optional(),
  notes: z.string().max(5000).nullable().optional(),
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\d{11}$/, "Telefone inválido").optional(),
  country: z.string().max(80).nullable().optional(),
  candidateCity: z.string().max(120).nullable().optional(),
  availablePresential: z.boolean().nullable().optional(),
  salaryExpectation: z.number().min(0).max(9999999).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("applications")
    .select("id, jobId, stageId")
    .eq("id", id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  // A etapa precisa existir e estar ativa no funil configurável.
  if (parsed.data.stageId !== undefined) {
    const { data: stage } = await supabase
      .from("application_stages")
      .select("id, active")
      .eq("id", parsed.data.stageId)
      .maybeSingle();
    if (!stage || !stage.active) {
      return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.stageId !== undefined) update.stageId = parsed.data.stageId;
  // Ao mudar de etapa, reseta sort_order → o card entra no fim da nova coluna por aiScore.
  if (parsed.data.stageId !== undefined && parsed.data.stageId !== current.stageId) {
    update.sort_order = null;
  }
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
  if (parsed.data.fullName !== undefined) update.fullName = parsed.data.fullName.trim();
  if (parsed.data.email !== undefined) update.email = parsed.data.email.trim().toLowerCase();
  if (parsed.data.phone !== undefined) update.phone = parsed.data.phone;
  if (parsed.data.country !== undefined) update.country = parsed.data.country;
  if (parsed.data.candidateCity !== undefined) update.candidateCity = parsed.data.candidateCity;
  if (parsed.data.availablePresential !== undefined) update.availablePresential = parsed.data.availablePresential;
  if (parsed.data.salaryExpectation !== undefined) update.salaryExpectation = parsed.data.salaryExpectation;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: application, error: updateError } = await supabase
    .from("applications")
    .update(update as any)
    .eq("id", id)
    .select("id, stageId, jobId, notes")
    .single();

  if (updateError || !application) {
    return NextResponse.json({ error: "Erro ao atualizar candidatura" }, { status: 500 });
  }

  // Só registra no histórico quando a etapa realmente muda.
  if (parsed.data.stageId && parsed.data.stageId !== current.stageId) {
    await supabase.from("application_stage_history").insert({
      applicationId: id,
      stageId: parsed.data.stageId,
      changedBy: session.user.name ?? session.user.email ?? "Admin",
    });
  }

  revalidatePath(`/vagas/${application.jobId}/candidatos`);
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, stageId: application.stageId, notes: application.notes });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("applications")
    .select("id, jobId, resumeUrl")
    .eq("id", id)
    .maybeSingle();
  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  // Remove o currículo do storage privado (retenção LGPD).
  if (application.resumeUrl) {
    try {
      await deleteResume(application.resumeUrl);
    } catch {
      // Se o blob já não existir, segue com a exclusão do registro.
    }
  }

  await supabase.from("applications").delete().eq("id", id);

  revalidatePath(`/vagas/${application.jobId}/candidatos`);
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true });
}
