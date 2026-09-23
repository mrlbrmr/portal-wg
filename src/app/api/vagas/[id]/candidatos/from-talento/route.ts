import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoWrite } from "@/lib/talentos/permissions";
import { addTalentsToJob } from "@/lib/talentos/service";

// Encaixa um talento existente numa vaga sem duplicar o cadastro (usado pelo modal
// "Incluir do banco de talentos" da página da vaga). Mesma regra do Banco de Talentos:
// src/lib/talentos/service.ts#addTalentsToJob — candidatura nova ligada ao mesmo perfil,
// origem BANCO_TALENTOS, sem candidatura duplicada na vaga.

const bodySchema = z.object({
  talentoId: z.string().min(1, "talentoId inválido"),
  stageId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;

  const access = await requireTalentoWrite();
  if (!access.ok) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "talentoId inválido" }, { status: 400 });

  const supabase = await createClient();
  const result = await addTalentsToJob(
    supabase,
    { id: access.userId, name: access.session.user.name ?? access.session.user.email ?? "Equipe de RH" },
    { talentoIds: [parsed.data.talentoId], jobId, stageId: parsed.data.stageId ?? null }
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const outcome = result.outcomes[0];
  if (outcome.status === "duplicate") {
    return NextResponse.json(
      { error: "Este talento já participa deste processo seletivo.", applicationId: outcome.applicationId },
      { status: 409 }
    );
  }
  if (outcome.status === "error") return NextResponse.json({ error: outcome.message }, { status: 400 });

  revalidatePath(`/vagas/${jobId}/candidatos`);
  revalidatePath("/talentos");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true, id: outcome.applicationId }, { status: 201 });
}
