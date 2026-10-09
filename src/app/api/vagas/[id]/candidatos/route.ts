import { NextRequest, NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { uploadResume, validateResumeFile } from "@/lib/storage";
import { applicantContactSchema } from "@/lib/application-schema";
import { BRAZIL_STATES } from "@/lib/utils";
import { resolveManualSource } from "@/lib/application-sources";
import { logConfigChange } from "@/lib/settings/audit";

// Rota INTERNA — cadastro MANUAL de candidato numa vaga (CV recebido por fora do
// portal: WhatsApp/Catho/Indeed/indicação). ADMIN_RH only, atrás do middleware.
// A origem vem do cadastro "Origens de candidatos" (`source` = código) ou é criada aqui
// mesmo (`newSource` = nome), para o RH medir de onde os candidatos vêm.
// Sem reCAPTCHA (sessão autenticada). CV é OPCIONAL. LGPD: sem consentimento de
// portal → consentAt = null; guarda-se a origem (source) e quem cadastrou (addedBy).

const fieldsSchema = applicantContactSchema.extend({
  source: z.string().trim().max(60).optional(),
  newSource: z.string().trim().max(120).optional(),
  // Localização opcional (mesmas colunas da candidatura pelo portal).
  candidateCity: z.string().trim().max(120).optional(),
  candidateState: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || (BRAZIL_STATES as readonly string[]).includes(v), "UF inválida.")
    .optional(),
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = fieldsSchema.safeParse({
    fullName: form.get("fullName"),
    email: form.get("email"),
    phone: form.get("phone"),
    source: form.get("source") ?? undefined,
    newSource: form.get("newSource") ?? undefined,
    candidateCity: form.get("candidateCity") ?? undefined,
    candidateState: form.get("candidateState") ?? undefined,
  });
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Dados inválidos." }, { status: 400 });
  }
  const { fullName, email, phone } = parsed.data;
  const candidateCity = parsed.data.candidateCity || null;
  const candidateState = parsed.data.candidateState || null;

  const supabase = await createClient();

  const origin = await resolveManualSource(supabase, {
    sourceId: parsed.data.source,
    newSourceName: parsed.data.newSource,
  });
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: 400 });
  }
  const source = origin.id;

  // A vaga precisa existir (não exige estar aberta — o RH pode cadastrar num
  // processo já em andamento).
  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Vaga não encontrada." }, { status: 404 });
  }

  // Currículo é opcional; se veio, valida e sobe ao bucket privado.
  let resume: { url: string; name: string } | null = null;
  const file = form.get("resume");
  if (file instanceof File && file.size > 0) {
    const check = validateResumeFile(file);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
    try {
      resume = await uploadResume(file, job.id);
    } catch {
      return NextResponse.json(
        { error: "Não foi possível enviar o currículo. Tente novamente." },
        { status: 502 }
      );
    }
  }

  const { data: application, error: createError } = await supabase
    .from("applications")
    .insert({
      jobId: job.id,
      fullName,
      email,
      phone,
      candidateCity,
      candidateState,
      source,
      addedBy: session.user.name ?? session.user.email ?? "Admin",
      resumeUrl: resume?.url ?? null,
      resumeName: resume?.name ?? null,
      consentAt: null,
    })
    .select("id")
    .single();

  if (createError || !application) {
    return NextResponse.json(
      { error: "Não foi possível cadastrar o candidato. Tente novamente." },
      { status: 500 }
    );
  }

  await supabase.from("application_stage_history").insert({
    applicationId: application.id,
    stageId: "NEW",
    changedBy: "RH (cadastro manual)",
  });

  // Sincroniza candidato no Banco de Talentos (silent — não bloqueia a resposta).
  const applicationId = application.id;
  after(async () => {
    try {
      const admin = createAdminClient();

      const { data: newTalento, error: talentoError } = await admin
        .from("talentos")
        .insert({
          nomeCompleto: fullName,
          email,
          telefone: phone || null,
          cidade: candidateCity,
          estado: candidateState,
          curriculoUrl: resume?.url ?? null,
          curriculoNome: resume?.name ?? null,
          origem: "VAGA_ESPECIFICA",
        })
        .select("id")
        .single();

      let syncedId = newTalento?.id;

      // Talento já existe (e-mail duplicado) — reutiliza registro existente.
      if (!syncedId && talentoError?.code === "23505") {
        const { data: byEmail } = await admin
          .from("talentos")
          .select("id")
          .ilike("email", email.trim())
          .maybeSingle();
        syncedId = byEmail?.id;
      }

      if (syncedId) {
        await admin
          .from("applications")
          .update({ talentoId: syncedId })
          .eq("id", applicationId);
      }
    } catch {
      // Falha silenciosa — candidatura já registrada com sucesso
    }
  });

  if (origin.created) {
    await logConfigChange(session, "cadastros.origens", `Origem de candidatos "${origin.name}" criada ao adicionar candidato`);
    revalidatePath("/configuracoes/cadastros/origens");
  }

  revalidatePath(`/vagas/${job.id}/candidatos`);
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, id: application.id }, { status: 201 });
}
