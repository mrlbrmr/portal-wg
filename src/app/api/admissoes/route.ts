import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { admissionSchema } from "@/lib/admissao/validation";
import { admissionInputToData } from "@/lib/admissao/data";
import { requireAdmissionWrite } from "@/lib/admissao/permissions";
import { instantiateChecklistFromTemplate } from "@/lib/admissao/checklist";

// POST /api/admissoes — cria uma admissão. Escrita = ADMIN_RH (ver permissions).
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfter } = rateLimit(`admissao:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

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

  const parsed = admissionSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Dados inválidos" }, { status: 400 });
  }

  const admission = await prisma.admission.create({
    data: {
      ...admissionInputToData(parsed.data),
      createdById: access.userId,
      updatedById: access.userId,
    },
    select: { id: true, templateId: true },
  });

  // Se um modelo de checklist foi escolhido, já instancia grupos/itens.
  if (admission.templateId) {
    try {
      await instantiateChecklistFromTemplate(admission.id, admission.templateId);
    } catch {
      // Não falha a criação da admissão se a aplicação do modelo falhar.
    }
  }

  revalidatePath("/admissoes");
  return NextResponse.json({ id: admission.id }, { status: 201 });
}
