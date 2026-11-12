import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreSession } from '@/lib/avaliacoes/scoring'
import { resolveAssessmentType, type Question } from '@/lib/avaliacoes/schema'
import { z } from 'zod'
import { SUPERSEDED_REASON, supersededSessionIds, type SessionLinkInput } from '@/lib/avaliacoes/link-validity'

const schema = z.object({
  answers: z.record(z.string(), z.string()),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createAdminClient()

  // Busca a sessão pelo token
  const { data: sess } = await supabase
    .from('assessment_sessions')
    .select('id, applicationId, templateId, submittedAt, startedAt, expiresAt, invalidadoEm')
    .eq('token', token)
    .maybeSingle()

  if (!sess || sess.invalidadoEm) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }

  if (sess.expiresAt && new Date(sess.expiresAt as string) < new Date()) {
    return NextResponse.json({ error: 'Link expirado' }, { status: 410 })
  }

  if (sess.submittedAt) {
    return NextResponse.json({ error: 'Avaliação já enviada' }, { status: 409 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  // Busca o template com questões
  const { data: template } = await supabase
    .from('assessment_templates')
    .select('id, name, kind, assessmentType, passingScore, questions')
    .eq('id', sess.templateId)
    .maybeSingle()

  if (!template) {
    return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
  }

  const questions = (template.questions as Question[]) ?? []
  const assessmentType = resolveAssessmentType({
    assessmentType: template.assessmentType as string | null,
    kind: template.kind as string,
    questions,
  })
  const { score, outcome, scoreBreakdown } = scoreSession(
    questions,
    parsed.data.answers,
    template.passingScore as number | null,
    assessmentType,
  )

  const now = new Date().toISOString()

  // Atualiza a sessão. `submittedAt is null` no WHERE evita envio duplo concorrente.
  const { data: updated, error: sessError } = await supabase
    .from('assessment_sessions')
    .update({
      answers: parsed.data.answers,
      submittedAt: now,
      score,
      outcome,
      scoreBreakdown,
      // startedAt = primeiro item respondido (POST /start). Sem ele, marca o envio.
      startedAt: (sess.startedAt as string | null) ?? now,
    })
    .eq('id', sess.id)
    .is('submittedAt', null)
    .select('id')
    .maybeSingle()

  if (sessError) {
    return NextResponse.json({ error: 'Erro ao salvar respostas' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Avaliação já enviada' }, { status: 409 })
  }

  // Outros envios pendentes do MESMO teste para a MESMA candidatura perdem o sentido:
  // invalida (nunca apaga) para a fila "aguardando o candidato" não contá-los para sempre.
  if (sess.applicationId) {
    const { data: siblings } = await supabase
      .from('assessment_sessions')
      .select('id, applicationId, templateId, submittedAt, invalidadoEm')
      .eq('applicationId', sess.applicationId)
      .eq('templateId', sess.templateId)
      .is('submittedAt', null)
      .is('invalidadoEm', null)
    const ids = supersededSessionIds(
      { id: sess.id as string, applicationId: sess.applicationId as string, templateId: sess.templateId as string, submittedAt: now, invalidadoEm: null },
      (siblings ?? []) as SessionLinkInput[],
    )
    if (ids.length > 0) {
      const { error: invError } = await supabase
        .from('assessment_sessions')
        .update({ invalidadoEm: now, motivoInvalidacao: SUPERSEDED_REASON })
        .in('id', ids)
        .is('submittedAt', null)
      if (invError) console.warn('[avaliacao/submit] invalidar envios duplicados:', invError.message)
    }
  }

  // O resultado fica SÓ em assessment_sessions (fonte única): a candidatura lê o teste de lá
  // (aba Avaliações e Histórico). Não há mais cópia em application_assessments.

  return NextResponse.json({ score, outcome, assessmentType, scoreBreakdown })
}
