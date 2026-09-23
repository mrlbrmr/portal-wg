import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoRead } from "@/lib/talentos/permissions";
import { searchTerms } from "@/lib/talentos/crm";

// GET — busca rápida de talentos (modal "Incluir do banco de talentos" na página da vaga).
// Mesma busca da listagem (view talentos_crm: nome, e-mail, telefone, cargo, tags…),
// sem arquivados. O cadastro manual é a server action createTalentAction.
export async function GET(req: NextRequest) {
  const access = await requireTalentoRead();
  if (!access.ok) return NextResponse.json({ error: "Não autorizado" }, { status: access.status });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "30", 10) || 30, 1), 50);

  const supabase = await createClient();
  let query = supabase
    .from("talentos_crm")
    .select("id, nomeCompleto, email, telefone, cidade, estado, cargoDesejado, ultimoCargoCv, situacao")
    .neq("situacao", "ARQUIVADO");
  for (const term of searchTerms(searchParams.get("search") ?? "")) query = query.ilike("busca", `%${term}%`);

  const { data, error } = await query.order("nomeCompleto", { ascending: true }).limit(limit);
  if (error) return NextResponse.json({ error: "Não foi possível buscar talentos." }, { status: 500 });

  return NextResponse.json(data ?? []);
}
