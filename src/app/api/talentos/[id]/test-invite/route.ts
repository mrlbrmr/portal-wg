import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoWrite } from "@/lib/talentos/permissions";
import { computeValidez } from "@/lib/talentos/validity";
import { z } from "zod";

const inviteSchema = z.object({
  templateId:    z.string().uuid(),
  applicationId: z.string().optional().nullable(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  forceReinvite: z.boolean().default(false),
});

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireTalentoWrite();
  if (!access.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: access.status });

  const { id: talentoId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 });

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { templateId, applicationId, expiresInDays, forceReinvite } = parsed.data;
  const supabase = await createClient();

  const { data: template, error: tplErr } = await supabase
    .from('assessment_templates')
    .select('id, name, validityMonths, isActive')
    .eq('id', templateId)
    .single();

  if (tplErr || !template) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
  if (!template.isActive) return NextResponse.json({ error: 'Template inativo' }, { status: 400 });

  if (!forceReinvite) {
    const { data: latestSession } = await supabase
      .from('assessment_sessions')
      .select('submittedAt, validoAte, invalidadoEm')
      .eq('talentoId', talentoId)
      .eq('templateId', templateId)
      .not('submittedAt', 'is', null)
      .order('submittedAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    const validez = computeValidez(latestSession);
    if (validez.valido) {
      return NextResponse.json(
        { error: 'Resultado válido já existe. Use forceReinvite: true para reaplicar.', validez },
        { status: 409 },
      );
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data: session, error: sessErr } = await supabase
    .from('assessment_sessions')
    .insert({
      talentoId,
      templateId,
      applicationId: applicationId ?? null,
      expiresAt:     expiresAt.toISOString(),
      sentBy:        access.userId,
    })
    .select('id, token, talentoId, templateId, expiresAt')
    .single();

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

  // TODO: enviar e-mail via Resend quando a página pública /teste/[token] for implementada
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json(
    { session, testeUrl: `${appUrl}/teste/${session.token}` },
    { status: 201 },
  );
}
