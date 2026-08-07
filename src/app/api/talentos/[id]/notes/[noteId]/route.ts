import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoWrite } from "@/lib/talentos/permissions";

interface Params { params: Promise<{ id: string; noteId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireTalentoWrite();
  if (!access.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: access.status });

  const { id: talentoId, noteId } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from('talento_notes')
    .delete()
    .eq('id', noteId)
    .eq('talentoId', talentoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
