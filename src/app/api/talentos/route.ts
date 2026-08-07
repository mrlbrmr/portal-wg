import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoWrite, requireTalentoRead } from "@/lib/talentos/permissions";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const access = await requireTalentoRead();
  if (!access.ok) return NextResponse.json({ error: "Não autorizado" }, { status: access.status });

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30"), 50);

  const supabase = await createClient();
  let query = supabase
    .from("talentos")
    .select("id, nomeCompleto, email, telefone, cidade, estado, cargoDesejado, statusBanco")
    .in("statusBanco", ["ATIVO", "EM_PROCESSO"])
    .order("nomeCompleto", { ascending: true })
    .limit(limit);

  if (search) {
    query = query.or(`nomeCompleto.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

const createSchema = z.object({
  nomeCompleto:  z.string().min(2).max(200),
  email:         z.string().email(),
  cpf:           z.string().optional().nullable(),
  telefone:      z.string().optional().nullable(),
  cidade:        z.string().optional().nullable(),
  estado:        z.string().max(2).optional().nullable(),
  cargoDesejado: z.string().optional().nullable(),
  linkedinUrl:   z.string().url().optional().nullable(),
  origem:        z.enum(['CANDIDATURA_ESPONTANEA', 'VAGA_ESPECIFICA', 'INDICACAO', 'IMPORTACAO'])
                   .default('CANDIDATURA_ESPONTANEA'),
});

export async function POST(req: NextRequest) {
  const access = await requireTalentoWrite();
  if (!access.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: access.status });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 });

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('talentos')
    .insert(parsed.data)
    .select('id, nomeCompleto, email, statusBanco, createdAt')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'E-mail ou CPF já cadastrado no banco de talentos' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
