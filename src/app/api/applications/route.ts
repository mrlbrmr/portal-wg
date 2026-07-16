import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { uploadResume, validateResumeFile } from "@/lib/storage";
import { isPublicJobStatus } from "@/lib/utils";

// Rota PÚBLICA — recebe candidaturas nativas do portal.
// LGPD: os dados gravados aqui NUNCA são devolvidos por esta rota nem por
// qualquer rota pública. Currículo vai para storage privado (Vercel Blob).

// E-mail no formato xxxx@xxxx.com
const emailSchema = z
  .string()
  .trim()
  .email("E-mail inválido")
  .max(150);

// Celular: aceita a máscara (xx) x xxxx-xxxx — validamos pelos dígitos (11).
const phoneSchema = z
  .string()
  .trim()
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    return digits.length === 11; // DDD (2) + 9 + 8 dígitos
  }, "Celular inválido. Use o formato (xx) x xxxx-xxxx.");

const fieldsSchema = z.object({
  jobId: z.string().min(1, "Vaga inválida"),
  fullName: z.string().trim().min(3, "Informe seu nome completo").max(120),
  email: emailSchema,
  phone: phoneSchema,
  consent: z
    .string()
    .refine((v) => v === "true" || v === "on" || v === "1", "É necessário aceitar o aviso de privacidade."),
  recaptchaToken: z.string().optional().nullable(),
});

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
    jobId: form.get("jobId"),
    fullName: form.get("fullName"),
    email: form.get("email"),
    phone: form.get("phone"),
    consent: form.get("consent"),
    recaptchaToken: form.get("recaptchaToken"),
  });
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Dados inválidos." }, { status: 400 });
  }

  const { jobId, fullName, email, phone, recaptchaToken } = parsed.data;

  // Verifica reCAPTCHA antes de qualquer trabalho pesado.
  const captcha = await verifyRecaptcha(recaptchaToken, {
    expectedAction: "submit_application",
    remoteIp: ip !== "unknown" ? ip : undefined,
  });
  if (!captcha.ok) {
    console.error("[applications] recaptcha falhou:", captcha.reason, "score:", captcha.score);
    return NextResponse.json(
      { error: "Falha na verificação de segurança. Recarregue a página e tente novamente." },
      { status: 400 }
    );
  }

  // A vaga precisa existir e estar em status aberto (visível no portal).
  // A inscrição pelo portal é o único modo desde 2026-07 (Tally aposentado).
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, slug: true },
  });
  if (!job || !isPublicJobStatus(job.status)) {
    return NextResponse.json(
      { error: "Esta vaga não está aberta para inscrição pelo portal." },
      { status: 404 }
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

  const application = await prisma.application.create({
    data: {
      jobId: job.id,
      fullName,
      email,
      phone,
      resumeUrl: resume.url,
      resumeName: resume.name,
      consentAt: new Date(),
      stageHistory: {
        create: { stage: "NEW", changedBy: "Candidato (inscrição)" },
      },
    },
    select: { id: true },
  });

  // Atualiza contadores no painel interno (não expõe dado nenhum).
  revalidatePath("/dashboard");
  revalidatePath(`/vagas/${job.id}/candidatos`);

  return NextResponse.json({ ok: true, id: application.id }, { status: 201 });
}
