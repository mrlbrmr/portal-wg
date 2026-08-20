import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { admissionSchema } from "@/lib/admissao/validation";
import { admissionInputToData } from "@/lib/admissao/data";
import { requireAdmissionWrite } from "@/lib/admissao/permissions";
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

  const supabase = await createClient();
  const { data: admission, error } = await supabase
    .from("admissions")
    .insert({
      ...admissionInputToData(parsed.data),
      createdById: access.userId,
      updatedById: access.userId,
    })
    .select("id")
    .single();
  if (error || !admission) {
    return NextResponse.json({ error: "Erro ao criar admissão" }, { status: 500 });
  }

  revalidatePath("/admissoes");
  return NextResponse.json({ id: admission.id }, { status: 201 });
}
