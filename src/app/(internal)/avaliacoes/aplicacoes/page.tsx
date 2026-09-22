import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/internal/PageHeader'
import { loadAssessmentSessions } from '@/lib/avaliacoes/sessions'
import { AplicacoesClient } from './AplicacoesClient'

export const metadata: Metadata = { title: 'Aplicações — Avaliações' }

/** Acompanhamento dos testes enviados: quem recebeu, quando, prazo e em que ponto está. */
export default async function AplicacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ teste?: string; status?: string }>
}) {
  const [session, supabase, params] = await Promise.all([auth(), createClient(), searchParams])
  const sessions = await loadAssessmentSessions(supabase)

  return (
    <div>
      <PageHeader
        title="Aplicações"
        subtitle="Avaliações enviadas aos candidatos e o andamento de cada uma."
      />
      <AplicacoesClient
        key={`${params.teste ?? ''}|${params.status ?? ''}`}
        sessions={sessions}
        canManage={session?.user.role === 'ADMIN_RH'}
        initialTemplateId={params.teste}
        initialStatus={params.status}
      />
    </div>
  )
}
