import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTalentoWrite } from "@/lib/talentos/permissions";
import { exportTalentData } from "@/lib/privacy/retention-service";

// Exportação dos dados do titular (LGPD art. 18). Só ADMIN_RH; fica registrada no log.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireTalentoWrite();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "Não autenticado." : "Sem permissão." }, { status: access.status });
  }
  const { id } = await params;
  const data = await exportTalentData(await createClient(), id);
  if (!data) return NextResponse.json({ error: "Talento não encontrado." }, { status: 404 });

  await createAdminClient().from("talento_audit_log").insert({
    talentoId: id,
    userId: access.userId,
    acao: "EXPORTOU",
    entidade: "talentos",
    entidadeId: id,
    descricao: `Dados do titular exportados por ${access.session.user.name ?? access.session.user.email ?? "usuário"}`,
  });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dados-titular-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
