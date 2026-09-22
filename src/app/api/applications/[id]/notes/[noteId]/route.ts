import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NOTE_COLUMNS, noteBodySchema } from "@/lib/application-notes";

// Editar/excluir uma anotação: só o próprio autor (ADMIN_RH). A policy de RLS repete a
// regra no banco; aqui a checagem explícita devolve 403 em vez de "nada atualizado".

type Params = { params: Promise<{ id: string; noteId: string }> };

async function loadOwnNote(applicationId: string, noteId: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") return { error: 403 as const };
  const supabase = await createClient();
  const { data: note } = await supabase
    .from("application_notes")
    .select("id, authorId, application:applications(jobId)")
    .eq("id", noteId)
    .eq("applicationId", applicationId)
    .maybeSingle();
  if (!note) return { error: 404 as const };
  if (note.authorId !== session.user.id) return { error: 403 as const };
  const jobId = (note.application as { jobId?: string } | null)?.jobId ?? null;
  return { supabase, jobId };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, noteId } = await params;
  const parsed = noteBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const own = await loadOwnNote(id, noteId);
  if ("error" in own) {
    return NextResponse.json(
      { error: own.error === 404 ? "Anotação não encontrada." : "Você só pode editar as suas anotações." },
      { status: own.error }
    );
  }

  const { data: note, error } = await own.supabase
    .from("application_notes")
    .update({ body: parsed.data.body })
    .eq("id", noteId)
    .select(NOTE_COLUMNS)
    .single();
  if (error || !note) return NextResponse.json({ error: "Não foi possível salvar a anotação." }, { status: 500 });

  return NextResponse.json({ note });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, noteId } = await params;
  const own = await loadOwnNote(id, noteId);
  if ("error" in own) {
    return NextResponse.json(
      { error: own.error === 404 ? "Anotação não encontrada." : "Você só pode excluir as suas anotações." },
      { status: own.error }
    );
  }

  const { error } = await own.supabase.from("application_notes").delete().eq("id", noteId);
  if (error) return NextResponse.json({ error: "Não foi possível excluir a anotação." }, { status: 500 });

  if (own.jobId) revalidatePath(`/vagas/${own.jobId}/candidatos`);
  return NextResponse.json({ ok: true });
}
