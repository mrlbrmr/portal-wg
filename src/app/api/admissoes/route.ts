import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { admissionSchema } from "@/lib/admissao/validation";
import { admissionInputToData } from "@/lib/admissao/data";
import { requireAdmissionWrite } from "@/lib/admissao/permissions";
// POST /api/admissoes — cria uma admissão. Escrita = ADMIN_RH (ver permissions).
//
// Contratação a partir do pipeline: o corpo pode trazer `jobPositionId` — a posição da vaga
// que o candidato vai ocupar. A posição é preenchida por job_position_fill() (trava de
// linha no banco); se ela tiver sido ocupada no meio do caminho, a admissão recém-criada
// é desfeita (soft delete) e a rota responde 409 — nunca fica admissão "sem posição".
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

  const rawPositionId = (body as { jobPositionId?: unknown }).jobPositionId;
  const jobPositionId = typeof rawPositionId === "string" && rawPositionId ? rawPositionId : null;
  if (jobPositionId) {
    if (!parsed.data.sourceApplicationId || !parsed.data.sourceJobId) {
      return NextResponse.json({ error: "Posição informada sem candidatura de origem." }, { status: 400 });
    }
    const { data: pos } = await supabase
      .from("job_positions")
      .select("id, jobId, status, positionNumber")
      .eq("id", jobPositionId)
      .maybeSingle();
    if (!pos || pos.jobId !== parsed.data.sourceJobId) {
      return NextResponse.json({ error: "Posição não encontrada nesta vaga." }, { status: 400 });
    }
    if (pos.status !== "OPEN") {
      return NextResponse.json(
        { error: "Esta posição não está mais em aberto. Recarregue a página e escolha outra." },
        { status: 409 }
      );
    }
  }

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

  let position: Record<string, unknown> | null = null;
  if (jobPositionId) {
    const { data: summary, error: fillError } = await supabase.rpc("job_position_fill", {
      p_position_id: jobPositionId,
      p_application_id: parsed.data.sourceApplicationId,
      p_admission_id: admission.id,
      p_expected_start: parsed.data.startDate || null,
      p_actor_user_id: access.userId,
      p_actor_name: access.session.user.name ?? access.session.user.email ?? "Admin",
    });
    if (fillError) {
      await supabase.from("admissions").update({ deletedAt: new Date().toISOString() }).eq("id", admission.id);
      return NextResponse.json(
        { error: fillError.message || "Não foi possível ocupar a posição." },
        { status: 409 }
      );
    }
    position = summary as Record<string, unknown>;
    revalidatePath(`/vagas/${parsed.data.sourceJobId}/editar`);
    revalidatePath(`/vagas/${parsed.data.sourceJobId}/candidatos`);
    revalidatePath("/vagas/gerenciar");
  }

  revalidatePath("/admissoes");
  return NextResponse.json({ id: admission.id, position }, { status: 201 });
}
