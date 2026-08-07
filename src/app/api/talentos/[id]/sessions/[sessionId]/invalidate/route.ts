import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTalentoWrite, canInvalidateSession } from "@/lib/talentos/permissions";
import { z } from "zod";

const invalidateSchema = z.object({
  motivo: z.string().min(5).max(500),
});

interface Params { params: Promise<{ id: string; sessionId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireTalentoWrite();
  if (!access.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: access.status });
  if (!canInvalidateSession(access.role)) {
    return NextResponse.json({ error: 'Apenas ADMIN_RH pode invalidar sessões de teste' }, { status: 403 });
  }

  const { id: talentoId, sessionId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 });

  const parsed = invalidateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('assessment_sessions')
    .update({
      invalidadoEm:      now,
      invalidadoPorId:   access.userId,
      motivoInvalidacao: parsed.data.motivo,
    })
    .eq('id', sessionId)
    .eq('talentoId', talentoId)
    .select('id, talentoId, templateId, invalidadoEm')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Sessão não encontrada ou não pertence a este talento' }, { status: 404 });
  }

  // Audit log via service_role (policy de insert só libera para service_role)
  const adminClient = createAdminClient();
  await adminClient.from('talento_audit_log').insert({
    talentoId,
    userId:     access.userId,
    acao:       'INVALIDOU_APLICACAO',
    entidade:   'assessment_sessions',
    entidadeId: sessionId,
    descricao:  `Sessão invalidada. Motivo: ${parsed.data.motivo}`,
    metadata:   { sessionId, motivo: parsed.data.motivo },
  });

  return NextResponse.json(data);
}
