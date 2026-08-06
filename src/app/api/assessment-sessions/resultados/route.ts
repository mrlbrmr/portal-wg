import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// GET /api/assessment-sessions/resultados → todas as sessões submetidas com info de candidato e vaga
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const supabase = await createClient()

  type RawSession = {
    id: string
    score: number | null
    outcome: string | null
    scoreBreakdown: Record<string, unknown> | null
    submittedAt: string
    sentBy: string | null
    template: { name: string; kind: string } | null
    application: { fullName: string; email: string; jobId: string } | null
  }

  const { data: rawSessions, error } = await supabase
    .from('assessment_sessions')
    .select(
      'id, score, outcome, scoreBreakdown, submittedAt, sentBy, createdAt, ' +
      'template:assessment_templates(name, kind), ' +
      'application:applications(fullName, email, jobId)'
    )
    .not('submittedAt', 'is', null)
    .order('submittedAt', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: 'Erro ao buscar resultados' }, { status: 500 })

  const sessions = (rawSessions ?? []) as unknown as RawSession[]

  const jobIds = [...new Set(sessions.map((s) => s.application?.jobId).filter(Boolean) as string[])]
  let jobTitles: Record<string, string> = {}
  if (jobIds.length > 0) {
    const { data: jobs } = await supabase.from('jobs').select('id, title').in('id', jobIds)
    jobTitles = Object.fromEntries((jobs ?? []).map((j) => [j.id, j.title]))
  }

  const result = sessions.map((s) => ({
    id: s.id,
    score: s.score,
    outcome: s.outcome,
    scoreBreakdown: s.scoreBreakdown,
    submittedAt: s.submittedAt,
    sentBy: s.sentBy,
    template: s.template,
    candidateName: s.application?.fullName ?? '—',
    candidateEmail: s.application?.email ?? '',
    jobTitle: jobTitles[s.application?.jobId ?? ''] ?? '—',
  }))

  return NextResponse.json({ sessions: result })
}
