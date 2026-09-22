import { CheckCircle2, XCircle } from 'lucide-react'
import { TONE_TEXT } from '@/components/ui/StatusBadge'
import { DEFAULT_PASSING_SCORE, isManualQuestion } from '@/lib/avaliacoes/schema'
import { RESULT_SITUATION, resultSituation } from '@/lib/avaliacoes/presentation'
import type { ScoreBreakdown } from '@/lib/avaliacoes/scoring'
import type { AssessmentSessionDetail } from '@/lib/avaliacoes/sessions'
import { cn, formatDateTime } from '@/lib/utils'
import { GradingForm, type GradingItem } from './GradingForm'
import { ResultSection } from './ResultSection'

/** Resultado de teste técnico: nota no critério, respostas objetivas e correção das dissertativas. */
export function TechnicalResult({ session, canManage }: { session: AssessmentSessionDetail; canManage: boolean }) {
  const situation = resultSituation(session, session.assessmentType)
  const meta = RESULT_SITUATION[situation]
  const passing = session.passingScore ?? DEFAULT_PASSING_SCORE
  const breakdown = (session.scoreBreakdown ?? {}) as ScoreBreakdown

  const objective = session.questions
    .map((q, i) => ({ q, index: i + 1 }))
    .filter(({ q }) => !isManualQuestion(q))
  const correctCount = objective.filter(({ q }) => session.answers[q.id] !== undefined && session.answers[q.id] === q.correctAnswer).length

  const manualPoints = new Map((breakdown.manual ?? []).map((m) => [m.id, m.points]))
  const grading: GradingItem[] = session.questions
    .map((q, i) => ({ q, index: i + 1 }))
    .filter(({ q }) => isManualQuestion(q))
    .map(({ q, index }) => ({
      id: q.id,
      index,
      text: q.text,
      weight: q.weight ?? 1,
      given: session.answers[q.id] ?? null,
      points: manualPoints.get(q.id) ?? null,
    }))

  const objEarned = breakdown.objectiveEarned
  const objTotal = breakdown.objectiveTotal

  return (
    <>
      <ResultSection title="Resultado">
        {session.score !== null ? (
          <div className="max-w-xl">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-sora text-[40px] font-semibold leading-none tabular-nums text-wg-ink">{Math.round(session.score)}%</span>
              <span className={cn('text-body font-semibold', TONE_TEXT[meta.tone])}>{meta.label}</span>
            </div>
            {/* Barra com marcador do critério. */}
            <div className="relative mt-4 h-2 rounded-full bg-[#EEF1EA]" aria-hidden>
              <div className="h-full rounded-full bg-wg-green-dark/70" style={{ width: `${Math.min(100, Math.max(0, session.score))}%` }} />
              <div className="absolute -top-1 h-4 w-0.5 rounded bg-wg-ink/60" style={{ left: `${passing}%` }} />
            </div>
            <p className="mt-2 text-meta text-wg-ink-muted">
              Critério: ≥ {passing}% · {correctCount} de {objective.length} objetivas corretas
              {grading.length > 0 && ` · ${grading.length} ${grading.length === 1 ? 'dissertativa corrigida' : 'dissertativas corrigidas'}`}
            </p>
          </div>
        ) : situation === 'AWAITING_GRADING' ? (
          <div className="max-w-xl">
            <p className="text-record-title text-warning-fg">Aguardando correção</p>
            <p className="mt-1 text-body text-wg-ink-secondary">
              {grading.length} {grading.length === 1 ? 'questão dissertativa precisa' : 'questões dissertativas precisam'} de correção
              para gerar a nota final.
              {objTotal ? ` Resultado parcial: ${objEarned ?? 0} de ${objTotal} pts nas objetivas (${Math.round(((objEarned ?? 0) / objTotal) * 100)}%).` : ''}
            </p>
            <p className="mt-2 text-meta text-wg-ink-muted">Critério: ≥ {passing}% na nota final.</p>
          </div>
        ) : (
          <p className="text-body text-wg-ink-muted">Este teste não gera nota automática.</p>
        )}
      </ResultSection>

      {grading.length > 0 && (
        <ResultSection
          id="correcao"
          title="Correção das dissertativas"
          description={
            session.gradedAt
              ? `Corrigido por ${session.gradedBy ?? 'RH'} em ${formatDateTime(session.gradedAt)}. Ajuste os pontos e salve para recalcular.`
              : 'Atribua os pontos de cada resposta (de 0 ao peso da questão).'
          }
        >
          <GradingForm sessionId={session.id} items={grading} canManage={canManage} />
        </ResultSection>
      )}

      {objective.length > 0 && (
        <ResultSection title="Respostas objetivas" description={`${correctCount} de ${objective.length} corretas.`}>
          <ol className="divide-y divide-wg-border-lighter">
            {objective.map(({ q, index }) => {
              const given = session.answers[q.id]
              const ok = given !== undefined && given === q.correctAnswer
              return (
                <li key={q.id} className="flex gap-3 py-3 first:pt-0">
                  {ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Correta" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Incorreta" />
                  )}
                  <div className="min-w-0">
                    <p className="text-body text-wg-ink">
                      <span className="mr-1.5 tabular-nums text-wg-ink-muted">{index}.</span>
                      {q.text}
                    </p>
                    <p className="mt-0.5 text-meta text-wg-ink-muted">
                      Resposta: <span className="text-wg-ink-secondary">{given ?? 'sem resposta'}</span>
                      {!ok && q.correctAnswer && (
                        <> · Correta: <span className="text-wg-ink-secondary">{q.correctAnswer}</span></>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </ResultSection>
      )}
    </>
  )
}
