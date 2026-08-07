import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Encaixa um talento existente numa vaga sem duplicar o cadastro.
// Copia nome/email/telefone/currículo do talento → candidatura.
// Atualiza statusBanco para EM_PROCESSO se estava ATIVO.

const bodySchema = z.object({
  talentoId: z.string().uuid("talentoId deve ser um UUID"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;

  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "talentoId inválido" }, { status: 400 });
  }

  const { talentoId } = parsed.data;
  const supabase = await createClient();

  const [{ data: job }, { data: talento }] = await Promise.all([
    supabase.from("jobs").select("id").eq("id", jobId).maybeSingle(),
    supabase
      .from("talentos")
      .select("id, nomeCompleto, email, telefone, curriculoUrl, curriculoNome, statusBanco")
      .eq("id", talentoId)
      .maybeSingle(),
  ]);

  if (!job) return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
  if (!talento) return NextResponse.json({ error: "Talento não encontrado" }, { status: 404 });

  // Impede duplicatas: mesmo talento na mesma vaga
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("jobId", jobId)
    .eq("talentoId", talentoId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Este candidato já está cadastrado nessa vaga." },
      { status: 409 }
    );
  }

  const { data: application, error: createError } = await supabase
    .from("applications")
    .insert({
      jobId: job.id,
      fullName: talento.nomeCompleto,
      email: talento.email,
      phone: talento.telefone ?? "",
      source: "BANCO_TALENTOS",
      talentoId: talento.id,
      addedBy: session.user.name ?? session.user.email ?? "Admin",
      resumeUrl: talento.curriculoUrl ?? null,
      resumeName: talento.curriculoNome ?? null,
      consentAt: null,
    })
    .select("id")
    .single();

  if (createError || !application) {
    return NextResponse.json(
      { error: "Não foi possível incluir o candidato. Tente novamente." },
      { status: 500 }
    );
  }

  await supabase.from("application_stage_history").insert({
    applicationId: application.id,
    stageId: "NEW",
    changedBy: "RH (banco de talentos)",
  });

  if (talento.statusBanco === "ATIVO") {
    await supabase
      .from("talentos")
      .update({ statusBanco: "EM_PROCESSO" })
      .eq("id", talentoId);
  }

  revalidatePath(`/vagas/${job.id}/candidatos`);
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, id: application.id }, { status: 201 });
}
