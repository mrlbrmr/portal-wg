import { MessageCircleQuestion } from 'lucide-react'
import { BigFiveRadar } from '@/components/internal/BigFiveChart'
import {
  BAND_LABEL,
  BIG_FIVE_INFO,
  bandWord,
  bigFiveBand,
  interviewPrompts,
  type BigFiveScores,
} from '@/lib/avaliacoes/big-five'
import { ResultSection } from './ResultSection'

/**
 * Perfil comportamental (Big Five): visão geral (radar + dimensões), interpretação por
 * dimensão e pontos para explorar na entrevista. Sem nota geral, sem aprovação, sem
 * ranking — é insumo para o recrutador, não critério eliminatório.
 */
export function BigFiveProfile({ scores }: { scores: BigFiveScores }) {
  const prompts = interviewPrompts(scores, 3)

  return (
    <>
      <ResultSection title="Visão geral">
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-10">
          <div className="mx-auto w-full max-w-[280px]">
            {/* O SVG tem tamanho fixo; o wrapper o reduz em telas estreitas. */}
            <div className="[&_svg]:h-auto [&_svg]:w-full">
              <BigFiveRadar scores={scores} size={280} />
            </div>
          </div>
          <ul className="divide-y divide-wg-border-lighter">
            {BIG_FIVE_INFO.map((d) => {
              const value = scores[d.key]
              return (
                <li key={d.key} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium text-wg-ink">
                      {d.label} <span className="font-normal text-wg-ink-muted">({d.key})</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF1EA]">
                      <div className="h-full rounded-full bg-[#7c3aed]/60" style={{ width: `${value ?? 0}%` }} />
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right">
                    <div className="text-record-title tabular-nums text-wg-ink">{value ?? '—'}</div>
                    {value !== null && <div className="text-[11.5px] text-wg-ink-muted">{bandWord(d, bigFiveBand(value))}</div>}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="mt-5 text-[12px] leading-relaxed text-wg-ink-muted">
          Cada valor é a média das respostas na escala do instrumento, convertida para 20–100 (60 = ponto neutro).
          Não é percentil nem nota: não há comparação com uma população de referência.
        </p>
      </ResultSection>

      <ResultSection title="Dimensões" description="Interpretação de cada fator neste instrumento.">
        <div className="grid gap-3 sm:grid-cols-2">
          {BIG_FIVE_INFO.map((d) => {
            const value = scores[d.key]
            const band = value !== null ? bigFiveBand(value) : null
            return (
              <article key={d.key} className="rounded-card border border-wg-border-lighter bg-white p-4">
                <header className="flex items-baseline justify-between gap-3">
                  <h3 className="text-record-title text-wg-ink">{d.label}</h3>
                  <span className="text-record-title tabular-nums text-wg-ink">{value ?? '—'}</span>
                </header>
                <p className="mt-0.5 text-[12px] text-wg-ink-muted">{d.measures}</p>
                {band ? (
                  <>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-wg-ink-muted">{BAND_LABEL[band]}</p>
                    <p className="mt-1 text-body text-wg-ink-secondary">{d.interpretation[band]}</p>
                  </>
                ) : (
                  <p className="mt-3 text-body text-wg-ink-muted">Sem respostas suficientes para esta dimensão.</p>
                )}
              </article>
            )
          })}
        </div>
      </ResultSection>

      {prompts.length > 0 && (
        <ResultSection
          title="Pontos para explorar na entrevista"
          description="Sugestões de perguntas a partir das dimensões mais marcantes do perfil. Não indicam se o candidato é adequado ou não à vaga."
        >
          <ul className="space-y-4">
            {prompts.map((p) => (
              <li key={p.key} className="flex gap-3">
                <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-wg-green-dark" aria-hidden />
                <div>
                  <p className="text-body font-semibold text-wg-ink">{p.title}</p>
                  <p className="mt-0.5 text-body text-wg-ink-secondary">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </ResultSection>
      )}
    </>
  )
}
