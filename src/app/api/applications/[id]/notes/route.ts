import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NOTE_COLUMNS, noteBodySchema } from "@/lib/application-notes";

// Anotações da equipe (application_notes). Staff lê; ADMIN_RH cria em nome próprio.
// Autor e permissões também são garantidos pelas policies de RLS da tabela.

// GET — anotações da candidatura (mais recentes primeiro) + quem está logado, para a UI
// saber quais notas são "minhas" (editar/excluir).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("application_notes")
    .select(NOTE_COLUMNS)
    .eq("applicationId", id)
    .order("createdAt", { ascending: false });
  if (error) return NextResponse.json({ error: "Erro ao carregar anotações." }, { status: 500 });

  return NextResponse.json({ notes: data ?? [], currentUserId: session.user.id });
}

// POST — cria uma anotação assinada por quem está logado.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const parsed = noteBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("applications")
    .select("id, jobId")
    .eq("id", id)
    .maybeSingle();
  if (!application) return NextResponse.json({ error: "Candidatura não encontrada." }, { status: 404 });

  const { data: note, error } = await supabase
    .from("application_notes")
    .insert({
      applicationId: id,
      body: parsed.data.body,
      authorId: session.user.id,
      authorName: session.user.name ?? session.user.email ?? "Equipe de RH",
    })
    .select(NOTE_COLUMNS)
    .single();
  if (error || !note) return NextResponse.json({ error: "Não foi possível salvar a anotação." }, { status: 500 });

  // O card do Kanban mostra o indicador "com anotações".
  revalidatePath(`/vagas/${application.jobId}/candidatos`);
  return NextResponse.json({ note }, { status: 201 });
}
