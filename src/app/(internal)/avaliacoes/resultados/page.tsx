import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ResultadosClient } from './ResultadosClient'

export const metadata: Metadata = { title: 'Resultados de Avaliações' }

export default async function ResultadosPage() {
  const [session, supabase] = await Promise.all([auth(), createClient()])

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

  const { data: rawSessions } = await supabase
    .from('assessment_sessions')
    .select(
      'id, score, outcome, scoreBreakdown, submittedAt, sentBy, ' +
      'template:assessment_templates(name, kind), ' +
      'application:applications(fullName, email, jobId)'
    )
    .not('submittedAt', 'is', null)
    .order('submittedAt', { ascending: false })
    .limit(500)

  const sessions = (rawSessions ?? []) as unknown as RawSession[]

  const jobIds = [...new Set(sessions.map((s) => s.application?.jobId).filter(Boolean) as string[])]
  let jobTitles: Record<string, string> = {}
  if (jobIds.length > 0) {
    const { data: jobs } = await supabase.from('jobs').select('id, title').in('id', jobIds)
    jobTitles = Object.fromEntries((jobs ?? []).map((j) => [j.id, j.title]))
  }

  const rows = sessions.map((s) => ({
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

  const isAdmin = session?.user.role === 'ADMIN_RH'

  return (
    <div className="max-w-6xl bg-slate-50">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Resultados de Avaliações</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {rows.length} avaliação{rows.length !== 1 ? 'ões' : ''} concluída{rows.length !== 1 ? 's' : ''}
        </p>
      </div>
      <ResultadosClient sessions={rows} isAdmin={isAdmin} />
    </div>
  )
}
