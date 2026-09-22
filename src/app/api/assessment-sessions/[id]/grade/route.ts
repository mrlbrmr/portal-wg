import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { scoreSession } from '@/lib/avaliacoes/scoring'
import { isManualQuestion, resolveAssessmentType, type Question } from '@/lib/avaliacoes/schema'

const bodySchema = z.object({
  /** Pontos por questão de correção manual (0..peso da questão). */
  grades: z.record(z.string(), z.number().min(0)),
})

/**
 * Correção manual de teste técnico com dissertativas. Recalcula a nota final a partir das
 * respostas + pontos informados (mesmo `scoreSession` do envio) e grava PASS/FAIL.
 * Comportamental é recusado: não existe correção de perfil.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN_RH') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id } = await params
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Pontuação inválida.' }, { status: 422 })

  const supabase = await createClient()
  const { data: sess } = await supabase
    .from('assessment_sessions')
    .select('id, answers, submittedAt, template:assessment_templates(name, kind, assessmentType, passingScore, questions)')
    .eq('id', id)
    .maybeSingle()

  const template = (sess?.template ?? null) as unknown as {
    name: string; kind: string; assessmentType: string | null; passingScore: number | null; questions: Question[]
  } | null
  if (!sess || !template) return NextResponse.json({ error: 'Aplicação não encontrada.' }, { status: 404 })
  if (!sess.submittedAt) return NextResponse.json({ error: 'O candidato ainda não enviou as respostas.' }, { status: 409 })

  const questions = template.questions ?? []
  const assessmentType = resolveAssessmentType({ ...template, questions })
  if (assessmentType === 'BEHAVIORAL') {
    return NextResponse.json({ error: 'Avaliação comportamental não tem correção.' }, { status: 400 })
  }

  const manual = questions.filter(isManualQuestion)
  if (manual.length === 0) {
    return NextResponse.json({ error: 'Este teste não tem questões de correção manual.' }, { status: 400 })
  }
  for (const q of manual) {
    const pts = parsed.data.grades[q.id]
    if (typeof pts !== 'number') return NextResponse.json({ error: 'Pontue todas as questões dissertativas.' }, { status: 422 })
    if (pts > (q.weight ?? 1)) return NextResponse.json({ error: 'Pontos acima do peso da questão.' }, { status: 422 })
  }

  const { score, outcome, scoreBreakdown } = scoreSession(
    questions,
    (sess.answers ?? {}) as Record<string, string>,
    template.passingScore,
    assessmentType,
    parsed.data.grades,
  )

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('assessment_sessions')
    .update({
      score,
      outcome,
      scoreBreakdown,
      gradedAt: now,
      gradedBy: session.user.name ?? session.user.email ?? 'RH',
    })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Erro ao salvar a correção.' }, { status: 500 })

  // Espelha a nota final no registro do histórico do candidato (criado no envio).
  await supabase
    .from('application_assessments')
    .update({
      score,
      outcome: outcome === 'PASS' || outcome === 'FAIL' ? outcome : null,
      summary: `Teste online: ${template.name}\nNota final após correção: ${score ?? '—'}/100`,
      metadata: { sessionId: id, scoreBreakdown },
    })
    .eq('metadata->>sessionId', id)

  return NextResponse.json({ score, outcome })
}
