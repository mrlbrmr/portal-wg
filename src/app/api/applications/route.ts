import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { saveResume } from "@/lib/file-storage";
import { sendApplicationConfirmation } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const BRAZIL_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const applicationSchema = z.object({
  fullName: z.string().min(3, "Nome completo obrigatório"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.enum(BRAZIL_STATES as [string, ...string[]], { message: "UF inválida" }),
  jobId: z.string().cuid("ID de vaga inválido"),
  notes: z.string().max(1000).optional(),
  privacyAcceptance: z.literal("true", { errorMap: () => ({ message: "Aceite do Aviso de Privacidade é obrigatório" }) }),
  talentPoolAcceptance: z.enum(["true", "false"]).optional(),
});

// POST /api/applications — candidatura pública (sem autenticação)
export async function POST(req: NextRequest) {
  // Processar multipart/form-data
  const formData = await req.formData();

  // Extrair campos
  const rawData = {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    state: formData.get("state"),
    jobId: formData.get("jobId"),
    notes: formData.get("notes") || undefined,
    privacyAcceptance: formData.get("privacyAcceptance"),
    talentPoolAcceptance: formData.get("talentPoolAcceptance") || "false",
  };

  const parsed = applicationSchema.safeParse(rawData);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Validar que a vaga existe e está ativa
  const job = await prisma.job.findUnique({
    where: { id: data.jobId, status: "ACTIVE" },
  });

  if (!job) {
    return NextResponse.json(
      { error: "Vaga não encontrada ou não está mais aceitando candidaturas." },
      { status: 404 }
    );
  }

  // Processar arquivo de currículo
  const resumeFile = formData.get("resume") as File | null;
  if (!resumeFile) {
    return NextResponse.json({ error: "Currículo é obrigatório" }, { status: 400 });
  }

  const resumeBuffer = Buffer.from(await resumeFile.arrayBuffer());

  let uploadResult;
  try {
    uploadResult = await saveResume(resumeBuffer, resumeFile.name, resumeFile.type);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao salvar currículo" },
      { status: 400 }
    );
  }

  // Verificar candidatura duplicada
  const existingCandidate = await prisma.candidate.findFirst({
    where: { email: data.email },
    include: {
      applications: { where: { jobId: data.jobId } },
    },
  });

  if (existingCandidate && existingCandidate.applications.length > 0) {
    return NextResponse.json(
      { error: "Você já se candidatou para esta vaga. Aguarde nosso contato." },
      { status: 409 }
    );
  }

  const now = new Date();
  const talentPool = data.talentPoolAcceptance === "true";

  // Criar ou atualizar candidato e candidatura em transação
  const application = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let candidate = existingCandidate;

    if (!candidate) {
      candidate = await tx.candidate.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          city: data.city,
          state: data.state,
          notes: data.notes,
          privacyAcceptance: true,
          privacyAcceptedAt: now,
          talentPoolAcceptance: talentPool,
          talentPoolAcceptedAt: talentPool ? now : null,
        },
        include: { applications: { where: { jobId: data.jobId } } },
      });
    }

    const app = await tx.application.create({
      data: {
        candidateId: candidate.id,
        jobId: data.jobId,
        resumeFilePath: uploadResult.filePath,
        resumeFileName: uploadResult.fileName,
        status: "RECEIVED",
      },
    });

    await tx.statusHistory.create({
      data: {
        applicationId: app.id,
        fromStatus: null,
        toStatus: "RECEIVED",
        changedByName: "Sistema",
      },
    });

    return app;
  });

  // Enviar e-mail de confirmação (não bloqueia a resposta em caso de falha)
  sendApplicationConfirmation({
    candidateName: data.fullName,
    candidateEmail: data.email,
    jobTitle: job.title,
    jobCity: job.city,
  }).catch(console.error);

  await logAudit({
    action: "APPLICATION_RECEIVED",
    entityType: "application",
    entityId: application.id,
    metadata: { jobId: data.jobId, jobTitle: job.title },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json(
    { message: "Candidatura enviada com sucesso!", applicationId: application.id },
    { status: 201 }
  );
}
