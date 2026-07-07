import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";

const updateMeSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "Nova senha deve ter pelo menos 8 caracteres").optional(),
  })
  .refine((d) => !(d.newPassword && !d.currentPassword), {
    message: "Informe a senha atual para trocar a senha.",
    path: ["currentPassword"],
  });

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfter } = rateLimit(ip, { limit: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
    );
  }

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const parsed = updateMeSchema.safeParse(body);
  if (!parsed.success) {
    const msgs = parsed.error.flatten();
    const first =
      Object.values(msgs.fieldErrors).flat()[0] ?? msgs.formErrors[0] ?? "Dados inválidos.";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { name, currentPassword, newPassword } = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (name) updateData.name = name;

  if (newPassword && currentPassword) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });
    if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });

    updateData.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nenhum dado para atualizar." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(updated);
}
