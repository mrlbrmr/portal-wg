import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// GET /api/applications/[id]/admission — retorna a admissão vinculada ou null.
// Nunca retorna 404: o drawer usa null para não mostrar a seção.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("admissions")
    .select("id, startDate, digitalFormSubmittedAt, stage:admission_stages(name, color)")
    .eq("sourceApplicationId", id)
    .is("deletedAt", null)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(data ?? null);
}
