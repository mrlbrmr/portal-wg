import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { INTERVIEW_COLUMNS } from "@/lib/recruitment/interviews/catalog";

// Entrevistas agendadas da candidatura (mais recentes primeiro). Staff lê; a RLS também garante.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("application_interviews")
    .select(INTERVIEW_COLUMNS)
    .eq("applicationId", id)
    .order("scheduledAt", { ascending: false });
  if (error) return NextResponse.json({ error: "Erro ao carregar as entrevistas." }, { status: 500 });

  return NextResponse.json({ interviews: data ?? [] });
}
