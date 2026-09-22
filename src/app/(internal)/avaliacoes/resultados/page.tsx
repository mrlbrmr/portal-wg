import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/internal/PageHeader'
import { loadAssessmentSessions } from '@/lib/avaliacoes/sessions'
import { ResultadosClient } from './ResultadosClient'

export const metadata: Metadata = { title: 'Resultados — Avaliações' }

/** Avaliações concluídas: nota no critério (técnico) ou perfil disponível (comportamental). */
export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>
}) {
  const [supabase, params] = await Promise.all([createClient(), searchParams])
  const sessions = await loadAssessmentSessions(supabase, { submittedOnly: true })

  return (
    <div>
      <PageHeader
        title="Resultados"
        subtitle={`${sessions.length} ${sessions.length === 1 ? 'avaliação concluída' : 'avaliações concluídas'}`}
      />
      <ResultadosClient key={params.situacao ?? ''} sessions={sessions} initialSituation={params.situacao} />
    </div>
  )
}
