import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResumeBuffer } from "@/lib/file-storage";
import { extractTextFromBuffer } from "@/lib/extract-text";
import { generateAiReview, generateMockReview } from "@/lib/claude";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const reviewSchema = z.object({
  applicationId: z.string().cuid(),
  useMock: z.boolean().optional().default(false),
});

// POST /api/ai-review — gerar análise de IA (somente ADMIN_RH)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { applicationId, useMock } = parsed.data;

  // Buscar candidatura com dados da vaga
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: {
        select: {
          title: true,
          description: true,
          requiredRequirements: true,
          desiredRequirements: true,
        },
      },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  let reviewData;

  // Usar mock se: solicitado explicitamente OU sem API key configurada
  const shouldMock = useMock || !process.env.GROQ_API_KEY;

  if (shouldMock) {
    reviewData = generateMockReview({
      title: application.job.title,
      description: application.job.description,
      requiredRequirements: application.job.requiredRequirements,
      desiredRequirements: application.job.desiredRequirements,
    });
  } else {
    // Extrair texto do currículo
    let resumeText: string;
    try {
      const buffer = await getResumeBuffer(application.resumeFilePath);
      resumeText = await extractTextFromBuffer(buffer, application.resumeFileName);
    } catch {
      return NextResponse.json(
        { error: "Não foi possível ler o currículo. Verifique se o arquivo existe." },
        { status: 500 }
      );
    }

    // Gerar análise real com Claude API
    try {
      reviewData = await generateAiReview(resumeText, {
        title: application.job.title,
        description: application.job.description,
        requiredRequirements: application.job.requiredRequirements,
        desiredRequirements: application.job.desiredRequirements,
      });
    } catch (err) {
      console.error("[AI Review] Erro na Claude API:", err);
      return NextResponse.json(
        { error: "Erro ao gerar análise com IA. Tente novamente." },
        { status: 500 }
      );
    }
  }

  // Salvar ou atualizar análise (upsert para suportar "Regerar")
  const aiReview = await prisma.aiReview.upsert({
    where: { applicationId },
    create: { applicationId, ...reviewData },
    update: { ...reviewData, updatedAt: new Date() },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "AI_REVIEW_GENERATED",
    entityType: "application",
    entityId: applicationId,
    metadata: { isMock: reviewData.isMock, model: reviewData.modelUsed },
  });

  return NextResponse.json(aiReview);
}
