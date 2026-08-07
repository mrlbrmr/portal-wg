import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoRead } from "@/lib/talentos/permissions";
import { z } from "zod";

const noteSchema = z.object({
  conteudo: z.string().min(1).max(5000),
});

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireTalentoRead();
  if (!access.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: access.status });

  const { id: talentoId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 });

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await createClient();

  const { error: checkErr } = await supabase
    .from('talentos').select('id').eq('id', talentoId).single();
  if (checkErr) return NextResponse.json({ error: 'Talento não encontrado' }, { status: 404 });

  const { data, error } = await supabase
    .from('talento_notes')
    .insert({ talentoId, autorId: access.userId, conteudo: parsed.data.conteudo })
    .select('id, talentoId, autorId, conteudo, createdAt, autor:users(id, name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('talentos')
    .update({ ultimaAtividadeEm: new Date().toISOString() })
    .eq('id', talentoId);

  return NextResponse.json(data, { status: 201 });
}
