import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreSession } from '@/lib/avaliacoes/scoring'
import { resolveAssessmentType, type Question } from '@/lib/avaliacoes/schema'
import { BIG_FIVE_INFO } from '@/lib/avaliacoes/big-five'
import { z } from 'zod'

const schema = z.object({
  answers: z.record(z.string(), z.string()),
})

// Mapeamento de kind do template para kind da application_assessments
const TEMPLATE_KIND_TO_ASSESSMENT_KIND: Record<string, string> = {
  SCREENING: 'TECHNICAL_TEST',
  TECHNICAL: 'TECHNICAL_TEST',
  PERSONALITY_BIG5: 'PERSONALITY_TEST',
}

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

  // Registra em application_assessments para aparecer no histórico do candidato.
  if (sess.applicationId) {
    const summaryParts: string[] = [`Teste online: ${template.name as string}`]
    if (scoreBreakdown.bigFive) {
      const bf = scoreBreakdown.bigFive
      summaryParts.push(
        BIG_FIVE_INFO.filter((d) => bf[d.key] !== null && bf[d.key] !== undefined)
          .map((d) => `${d.label}: ${bf[d.key]}`)
          .join(' · ')
      )
    } else if (outcome === 'PENDING_REVIEW') {
      summaryParts.push('Aguardando correção das questões dissertativas.')
    }

    await supabase.from('application_assessments').insert({
      applicationId: sess.applicationId,
      kind: TEMPLATE_KIND_TO_ASSESSMENT_KIND[template.kind as string] ?? 'OTHER',
      source: 'HUMAN',
      title: template.name as string,
      score: score ?? null,
      // Só PASS/FAIL viram outcome: comportamental não tem, dissertativa pendente ainda não tem.
      outcome: outcome === 'PASS' || outcome === 'FAIL' ? outcome : null,
      summary: summaryParts.join('\n'),
      evaluator: 'Automático',
      occurredAt: now,
      metadata: { sessionId: sess.id, scoreBreakdown },
    })
  }

  return NextResponse.json({ score, outcome, assessmentType, scoreBreakdown })
}
