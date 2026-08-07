import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoWrite } from "@/lib/talentos/permissions";
import { z } from "zod";

const tagsSchema = z.object({
  tagIds: z.array(z.string()).max(20),
});

interface Params { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireTalentoWrite();
  if (!access.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: access.status });

  const { id: talentoId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 });

  const parsed = tagsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await createClient();

  const { error: checkErr } = await supabase
    .from('talentos').select('id').eq('id', talentoId).single();
  if (checkErr) return NextResponse.json({ error: 'Talento não encontrado' }, { status: 404 });

  await supabase.from('talento_tag_assignments').delete().eq('talentoId', talentoId);

  if (parsed.data.tagIds.length > 0) {
    const rows = parsed.data.tagIds.map((tagId) => ({ talentoId, tagId }));
    const { error } = await supabase.from('talento_tag_assignments').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: tags } = await supabase
    .from('talento_tag_assignments')
    .select('tag:talento_tags(id, nome, cor)')
    .eq('talentoId', talentoId);

  return NextResponse.json({ tags: tags?.map((r) => r.tag) ?? [] });
}
