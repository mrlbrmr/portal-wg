import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreSession } from '@/lib/avaliacoes/scoring'
import type { Question } from '@/lib/avaliacoes/schema'
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

// Mapeamento de outcome interno para assessment outcome
const OUTCOME_MAP: Record<string, string> = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PENDING_REVIEW: 'PENDING',
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
    .select('id, applicationId, templateId, submittedAt, expiresAt')
    .eq('token', token)
    .maybeSingle()

  if (!sess) {
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
    .select('id, name, kind, passingScore, questions')
    .eq('id', sess.templateId)
    .maybeSingle()

  if (!template) {
    return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
  }

  const questions = (template.questions as Question[]) ?? []
  const { score, outcome, scoreBreakdown } = scoreSession(
    questions,
    parsed.data.answers,
    template.passingScore as number | null,
    template.kind as string,
  )

  const now = new Date().toISOString()

  // Atualiza a sessão
  const { error: sessError } = await supabase
    .from('assessment_sessions')
    .update({
      answers: parsed.data.answers,
      submittedAt: now,
      score,
      outcome,
      scoreBreakdown,
      startedAt: now, // marca startedAt se ainda não estava
    })
    .eq('id', sess.id)

  if (sessError) {
    return NextResponse.json({ error: 'Erro ao salvar respostas' }, { status: 500 })
  }

  // Registra em application_assessments para aparecer no CandidateDrawer
  const bigFive = scoreBreakdown?.bigFive as Record<string, number | null> | undefined
  const summaryParts: string[] = [`Teste online: ${template.name as string}`]
  if (bigFive) {
    const dimLabels: Record<string, string> = { O: 'Abertura', C: 'Conscienciosidade', E: 'Extroversão', A: 'Amabilidade', N: 'Neuroticismo' }
    summaryParts.push(
      Object.entries(bigFive)
        .filter(([, v]) => v !== null)
        .map(([d, v]) => `${dimLabels[d]}: ${v}%`)
        .join(' · ')
    )
  }

  await supabase.from('application_assessments').insert({
    applicationId: sess.applicationId,
    kind: TEMPLATE_KIND_TO_ASSESSMENT_KIND[template.kind as string] ?? 'OTHER',
    source: 'HUMAN',
    title: template.name as string,
    score: score ?? null,
    outcome: outcome ? OUTCOME_MAP[outcome] : null,
    summary: summaryParts.join('\n'),
    evaluator: 'Automático',
    occurredAt: now,
    metadata: { sessionId: sess.id, scoreBreakdown },
  })

  return NextResponse.json({ score, outcome, scoreBreakdown })
}
