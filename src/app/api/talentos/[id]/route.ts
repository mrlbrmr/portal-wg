import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoWrite } from "@/lib/talentos/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateSchema = z.object({
  nomeCompleto:             z.string().min(2).max(200).optional(),
  telefone:                 z.string().optional().nullable(),
  cidade:                   z.string().optional().nullable(),
  estado:                   z.string().max(2).optional().nullable(),
  cargoDesejado:            z.string().optional().nullable(),
  pretensaoSalarial:        z.number().optional().nullable(),
  linkedinUrl:              z.string().url().optional().nullable(),
  resumoProfissional:       z.string().optional().nullable(),
  statusBanco:              z.enum(['ATIVO', 'EM_PROCESSO', 'CONTRATADO', 'NAO_ADERENTE', 'ARQUIVADO']).optional(),
  consentimentoValidadeAte: z.string().datetime().optional().nullable(),
}).strict();

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireTalentoWrite();
  if (!access.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: access.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 });

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('talentos')
    .update({ ...parsed.data, ultimaAtividadeEm: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Talento não encontrado' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath('/talentos');
  revalidatePath(`/talentos/${id}`);
  return NextResponse.json(data);
}
