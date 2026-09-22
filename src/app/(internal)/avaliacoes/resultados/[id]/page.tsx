import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { BigFiveProfile } from '@/components/internal/avaliacoes/result/BigFiveProfile'
import { TechnicalResult } from '@/components/internal/avaliacoes/result/TechnicalResult'
import { DetailList, ResultSection } from '@/components/internal/avaliacoes/result/ResultSection'
import { loadAssessmentSession } from '@/lib/avaliacoes/sessions'
import { parseBigFive } from '@/lib/avaliacoes/big-five'
import {
  APPLICATION_STATUS,
  ASSESSMENT_TYPE_DETAIL,
  RESULT_SITUATION,
  applicationStatus,
  criterionLabel,
  fillDurationMs,
  formatDuration,
  isBehavioral,
  itemsLabel,
  resultSituation,
  templateCategory,
} from '@/lib/avaliacoes/presentation'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Resultado — Avaliações' }

/**
 * Resultado de uma avaliação. Hierarquia: candidato → avaliação → resultado/gráfico →
 * dimensões → interpretação → pontos de entrevista → detalhes técnicos da aplicação.
 */
export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [session, supabase] = await Promise.all([auth(), createClient()])
  const s = await loadAssessmentSession(supabase, id)
  if (!s) notFound()

  const canManage = session?.user.role === 'ADMIN_RH'
  const behavioral = isBehavioral(s.assessmentType)
  const status = applicationStatus(s, s.assessmentType)
  const badge = s.submittedAt ? RESULT_SITUATION[resultSituation(s, s.assessmentType)] : APPLICATION_STATUS[status]
  const bigFive = behavioral ? parseBigFive(s.scoreBreakdown) : null
  const category = templateCategory(s.kind, null)
  const items = itemsLabel(s.assessmentType, s.questions)
  const duration = fillDurationMs(s.startedAt, s.submittedAt)

  return (
    <div className="max-w-5xl">
      <Link
        href="/avaliacoes/resultados"
        className="mb-4 inline-flex items-center gap-1.5 text-meta text-wg-ink-muted transition-colors hover:text-wg-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Resultados
      </Link>

      {/* Cabeçalho: candidato em primeiro, avaliação em seguida. */}
      <header className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge tone={badge.tone} icon={behavioral && s.submittedAt ? CheckCircle2 : undefined}>
            {badge.label}
          </StatusBadge>
          <span className="text-meta text-wg-ink-muted">
            {behavioral ? 'Avaliação comportamental · Big Five' : ASSESSMENT_TYPE_DETAIL[s.assessmentType]}
          </span>
        </div>
        <h1 className="font-sora text-2xl font-semibold tracking-tight text-wg-ink md:text-page-title">{s.candidateName}</h1>
        <p className="mt-1 text-record-title font-medium text-wg-ink-secondary">{s.templateName}</p>
        <p className="mt-1 text-meta text-wg-ink-muted">
          {s.jobTitle && (
            <>
              {s.jobId ? (
                <Link href={`/vagas/${s.jobId}/candidatos`} className="hover:text-wg-ink hover:underline">{s.jobTitle}</Link>
              ) : (
                s.jobTitle
              )}
              {' · '}
            </>
          )}
          {s.submittedAt ? `Concluído em ${formatDate(s.submittedAt)}` : `Enviado em ${formatDate(s.createdAt)}`}
        </p>
      </header>

      {!s.submittedAt ? (
        <div className="rounded-card border border-wg-border-lighter bg-white">
          <EmptyState
            compact
            title="Avaliação ainda não concluída."
            description={`Situação: ${APPLICATION_STATUS[status].label.toLowerCase()}. O resultado aparece aqui quando o candidato enviar as respostas.`}
          />
        </div>
      ) : behavioral ? (
        bigFive ? (
          <BigFiveProfile scores={bigFive} />
        ) : (
          <p className="text-body text-wg-ink-muted">Não há dados de perfil registrados para esta aplicação.</p>
        )
      ) : (
        <TechnicalResult session={s} canManage={canManage} />
      )}

      <ResultSection title="Detalhes da aplicação">
        <DetailList
          items={[
            ['Teste', s.templateName],
            ['Categoria', behavioral ? 'Avaliação comportamental' : `Teste técnico${category.primary === 'Triagem' ? ' · Triagem' : ''}`],
            ['Modelo', behavioral ? 'Big Five (cinco grandes fatores)' : null],
            [behavioral ? 'Itens' : 'Questões', items.count.replace(/ .*/, '')],
            ['Escala', behavioral && items.detail ? items.detail.replace('Escala ', '') : null],
            ['Critério', criterionLabel(s.assessmentType, s.passingScore)],
            ['Vaga', s.jobTitle],
            ['E-mail do candidato', s.candidateEmail || null],
            ['Enviado por', s.sentBy],
            ['Enviado em', formatDate(s.createdAt)],
            ['Prazo', s.expiresAt ? formatDate(s.expiresAt) : null],
            ['Concluído em', s.submittedAt ? formatDate(s.submittedAt) : null],
            ['Tempo de preenchimento', duration ? formatDuration(duration) : null],
          ]}
        />
        {behavioral && (
          <p className="mt-6 max-w-2xl text-[12px] leading-relaxed text-wg-ink-muted">
            A avaliação comportamental descreve tendências de perfil e apoia a interpretação do recrutador. Não tem nota,
            aprovação ou correção, e não deve ser usada como critério eliminatório.
          </p>
        )}
      </ResultSection>
    </div>
  )
}
