import { NextRequest, NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { uploadResume, validateResumeFile, RESUMES_BUCKET } from "@/lib/storage";
import { isPublicJobStatus } from "@/lib/utils";
import { applicantContactSchema, applicantCpfSchema } from "@/lib/application-schema";
import { extractCvProfile } from "@/lib/ai/cv-analyzer";

// Rota PÚBLICA — recebe candidaturas nativas do portal.
// LGPD: os dados gravados aqui NUNCA são devolvidos por esta rota nem por
// qualquer rota pública. Currículo vai para storage privado (Supabase Storage).

const fieldsSchema = applicantContactSchema.extend({
  cpf: applicantCpfSchema,
  jobId: z.string().min(1, "Vaga inválida"),
  consent: z
    .string()
    .refine((v) => v === "true" || v === "on" || v === "1", "É necessário aceitar o aviso de privacidade."),
  recaptchaToken: z.string().optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  candidateCity: z.string().max(150).optional().nullable(),
  candidateState: z.string().max(2).optional().nullable(),
  salaryExpectation: z.string().optional().nullable(),
});

// Extrai e armazena o perfil do CV de forma assíncrona (pós-resposta ao candidato).
// Erros são silenciosos para o candidato — apenas atualizam cv_extraction_status.
async function runCvExtraction(
  applicationId: string,
  resumeUrl: string,
  resumeName: string,
): Promise<void> {
  const supabase = createAdminClient();

  if (!resumeName.toLowerCase().endsWith(".pdf")) {
    await supabase
      .from("applications")
      .update({ cv_extraction_status: "MANUAL_REVIEW" })
      .eq("id", applicationId);
    return;
  }

  const { data: signedData } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(resumeUrl, 120);

  if (!signedData?.signedUrl) {
    await supabase
      .from("applications")
      .update({ cv_extraction_status: "FAILED" })
      .eq("id", applicationId);
    return;
  }

  let pdfBuffer: Buffer;
  try {
    const fileRes = await fetch(signedData.signedUrl);
    if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
    pdfBuffer = Buffer.from(await fileRes.arrayBuffer());
  } catch {
    await supabase
      .from("applications")
      .update({ cv_extraction_status: "FAILED" })
      .eq("id", applicationId);
    return;
  }

  try {
    const profile = await extractCvProfile(pdfBuffer);
    await supabase
      .from("applications")
      .update({ cv_profile: profile, cv_extraction_status: "SUCCESS" })
      .eq("id", applicationId);
  } catch {
    await supabase
      .from("applications")
      .update({ cv_extraction_status: "FAILED" })
      .eq("id", applicationId);
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Rate-limit mais restrito para submissão pública.
  const { allowed, retryAfter } = rateLimit(`apply:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns instantes e tente novamente." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

  // Parse multipart/form-data
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = fieldsSchema.safeParse({
    cpf: form.get("cpf"),
    jobId: form.get("jobId"),
    fullName: form.get("fullName"),
    email: form.get("email"),
    phone: form.get("phone"),
    consent: form.get("consent"),
    recaptchaToken: form.get("recaptchaToken"),
    country: form.get("country"),
    candidateCity: form.get("candidateCity"),
    candidateState: form.get("candidateState"),
    salaryExpectation: form.get("salaryExpectation"),
  });
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Dados inválidos." }, { status: 400 });
  }

  const {
    cpf,
    jobId,
    fullName,
    email,
    phone,
    recaptchaToken,
    country,
    candidateCity,
    candidateState,
    salaryExpectation,
  } = parsed.data;

  // reCAPTCHA v3 é ADVISORY (ver src/lib/recaptcha.ts): só bloqueia bot evidente
  // (token válido + score muito baixo). Token ausente/expirado e score moderado —
  // falso-positivos comuns em mobile/4G — passam. Anti-abuso real = rate-limit acima
  // + revisão manual no Kanban.
  const captcha = await verifyRecaptcha(recaptchaToken, {
    expectedAction: "submit_application",
    remoteIp: ip !== "unknown" ? ip : undefined,
  });
  if (!captcha.ok) {
    return NextResponse.json(
      { error: "Falha na verificação de segurança. Recarregue a página e tente novamente." },
      { status: 400 }
    );
  }

  // A vaga precisa existir e estar em status aberto (visível no portal).
  const supabase = createAdminClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, slug")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || !isPublicJobStatus(job.status)) {
    return NextResponse.json(
      { error: "Esta vaga não está aberta para inscrição pelo portal." },
      { status: 404 }
    );
  }

  // Verifica duplicata: mesmo CPF já candidatado a esta vaga.
  const cpfDigits = cpf.replace(/\D/g, "");
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("jobId", job.id)
    .eq("cpf_digits", cpfDigits)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Você já enviou uma candidatura para esta vaga com este CPF." },
      { status: 409 }
    );
  }

  // Currículo
  const file = form.get("resume");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Anexe seu currículo." }, { status: 400 });
  }
  const fileCheck = validateResumeFile(file);
  if (!fileCheck.ok) {
    return NextResponse.json({ error: fileCheck.error }, { status: 400 });
  }

  let resume: { url: string; name: string };
  try {
    resume = await uploadResume(file, job.id);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível enviar o currículo. Tente novamente." },
      { status: 502 }
    );
  }

  const termsVersion = (form.get("termsVersion") as string | null) ?? "1.0";

  const { data: application, error: createError } = await supabase
    .from("applications")
    .insert({
      jobId: job.id,
      cpf,
      fullName,
      email,
      phone,
      resumeUrl: resume.url,
      resumeName: resume.name,
      consentAt: new Date().toISOString(),
      consentIp: ip !== "unknown" ? ip : null,
      termsVersion,
      country: country || null,
      candidateCity: candidateCity || null,
      candidateState: candidateState || null,
      salaryExpectation:
        salaryExpectation && salaryExpectation !== "" ? parseFloat(salaryExpectation) : null,
    })
    .select("id")
    .single();

  if (createError || !application) {
    return NextResponse.json(
      { error: "Não foi possível registrar sua candidatura. Tente novamente." },
      { status: 500 }
    );
  }

  await supabase.from("application_stage_history").insert({
    applicationId: application.id,
    stageId: "NEW",
    changedBy: "Candidato (inscrição)",
  });

  // Extração assíncrona do perfil do CV — não bloqueia a resposta ao candidato.
  after(async () => {
    await runCvExtraction(application.id, resume.url, resume.name);
  });

  // Atualiza contadores no painel interno.
  revalidatePath("/dashboard");
  revalidatePath(`/vagas/${job.id}/candidatos`);

  return NextResponse.json({ ok: true, id: application.id }, { status: 201 });
}
