import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// GET /api/admissoes/meta — dados de configuração para o modal de admissão:
// positions[], companies[], branches[], templates[], intakeStageId
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const supabase = await createClient();

  const [
    { data: positions },
    { data: companies },
    { data: branches },
    { data: templates },
    { data: intakeStage },
  ] = await Promise.all([
    supabase.from("admission_positions").select("id, name").order("sortOrder", { ascending: true }),
    supabase.from("admission_companies").select("id, name").order("sortOrder", { ascending: true }),
    supabase.from("admission_branches").select("id, name").order("sortOrder", { ascending: true }),
    supabase.from("admission_templates").select("id, name").order("name", { ascending: true }),
    supabase
      .from("admission_stages")
      .select("id")
      .eq("name", "Envio do formulário admissional")
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    positions: positions ?? [],
    companies: companies ?? [],
    branches: branches ?? [],
    templates: templates ?? [],
    intakeStageId: intakeStage?.id ?? null,
  });
}
