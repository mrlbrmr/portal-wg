"use client"

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart3, ChevronRight } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge, TONE_TEXT } from '@/components/ui/StatusBadge'
import { CellSub, FilterSelect, SearchField, rowClass, tableShell, tdClass, thClass } from '@/components/internal/avaliacoes/ui'
import {
  ASSESSMENT_TYPE_LABEL,
  RESULT_SITUATION,
  isBehavioral,
  resultSituation,
  type ResultSituation,
} from '@/lib/avaliacoes/presentation'
import { parseBigFive, salientDimensions } from '@/lib/avaliacoes/big-five'
import type { AssessmentSessionRow } from '@/lib/avaliacoes/sessions'
import { cn, formatDate, normalizeText } from '@/lib/utils'

type CategoryFilter = 'ALL' | 'TECHNICAL' | 'BEHAVIORAL'
type SituationFilter = 'ALL' | ResultSituation

const SITUATION_OPTIONS: Array<{ value: SituationFilter; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'ABOVE', label: RESULT_SITUATION.ABOVE.label },
  { value: 'BELOW', label: RESULT_SITUATION.BELOW.label },
  { value: 'AWAITING_GRADING', label: RESULT_SITUATION.AWAITING_GRADING.label },
  { value: 'PROFILE', label: RESULT_SITUATION.PROFILE.label },
]

interface Props {
  sessions: AssessmentSessionRow[]
  initialSituation?: string
}

/** Célula "Resultado": nota no critério (técnico), correção pendente ou perfil (comportamental). */
function ResultCell({ s, situation }: { s: AssessmentSessionRow; situation: ResultSituation }) {
  const meta = RESULT_SITUATION[situation]

  if (situation === 'PROFILE') {
    const bf = parseBigFive(s.scoreBreakdown)
    const top = bf ? salientDimensions(bf, 2) : []
    return (
      <div>
        <div className="font-medium text-wg-ink">{meta.label}</div>
        <CellSub>
          {top.length > 0 ? top.map((d) => `${d.info.label} ${d.value}`).join(' · ') : 'Ver perfil comportamental'}
        </CellSub>
      </div>
    )
  }

  if (situation === 'AWAITING_GRADING') {
    const b = s.scoreBreakdown as { objectiveEarned?: number; objectiveTotal?: number } | null
    return (
      <div>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        {b?.objectiveTotal ? (
          <CellSub>Parcial: {b.objectiveEarned ?? 0} de {b.objectiveTotal} pts nas objetivas</CellSub>
        ) : null}
      </div>
    )
  }

  if (s.score !== null) {
    return (
      <div>
        <div className="text-record-title tabular-nums text-wg-ink">{Math.round(s.score)}%</div>
        <div className={cn('text-[12px] font-medium', TONE_TEXT[meta.tone])}>{meta.label}</div>
      </div>
    )
  }

  return <span className="text-wg-ink-muted">{meta.label}</span>
}

export function ResultadosClient({ sessions, initialSituation }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('ALL')
  const [situation, setSituation] = useState<SituationFilter>(
    SITUATION_OPTIONS.some((o) => o.value === initialSituation) ? (initialSituation as SituationFilter) : 'ALL'
  )
  const [jobId, setJobId] = useState('ALL')

  const rows = useMemo(
    () => sessions.map((s) => ({ ...s, situation: resultSituation(s, s.assessmentType) })),
    [sessions],
  )

  const jobs = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sessions) if (s.jobId && s.jobTitle) map.set(s.jobId, s.jobTitle)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [sessions])

  const visible = useMemo(() => {
    const q = normalizeText(search)
    return rows.filter((s) => {
      if (category === 'BEHAVIORAL' && !isBehavioral(s.assessmentType)) return false
      if (category === 'TECHNICAL' && isBehavioral(s.assessmentType)) return false
      if (situation !== 'ALL' && s.situation !== situation) return false
      if (jobId !== 'ALL' && s.jobId !== jobId) return false
      if (q && !normalizeText(`${s.candidateName} ${s.candidateEmail} ${s.jobTitle ?? ''} ${s.templateName}`).includes(q)) return false
      return true
    })
  }, [rows, search, category, situation, jobId])

  const hasFilter = search !== '' || category !== 'ALL' || situation !== 'ALL' || jobId !== 'ALL'
  const clearFilters = () => { setSearch(''); setCategory('ALL'); setSituation('ALL'); setJobId('ALL') }

  if (sessions.length === 0) {
    return (
      <div className={tableShell}>
        <EmptyState
          icon={BarChart3}
          title="Nenhum resultado encontrado."
          description="Os resultados aparecem aqui assim que os candidatos concluírem as avaliações enviadas."
          action={<ButtonLink href="/avaliacoes/aplicacoes" variant="secondary">Ver aplicações</ButtonLink>}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar candidato, vaga ou avaliação..." className="max-w-md" />
        <FilterSelect<CategoryFilter>
          label="Categoria"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'ALL', label: 'Todas' },
            { value: 'TECHNICAL', label: 'Técnico' },
            { value: 'BEHAVIORAL', label: 'Comportamental' },
          ]}
        />
        <FilterSelect<SituationFilter> label="Situação" value={situation} onChange={setSituation} options={SITUATION_OPTIONS} />
        {jobs.length > 0 && (
          <FilterSelect
            label="Vaga"
            value={jobId}
            onChange={setJobId}
            options={[{ value: 'ALL', label: 'Todas' }, ...jobs.map(([id, title]) => ({ value: id, label: title }))]}
          />
        )}
      </div>

      {hasFilter && (
        <p className="mb-3 text-meta text-wg-ink-muted">
          {visible.length} de {sessions.length} {sessions.length === 1 ? 'resultado' : 'resultados'}
          <button type="button" onClick={clearFilters} className="ml-2 font-medium text-wg-green-dark hover:underline">
            Limpar filtros
          </button>
        </p>
      )}

      {visible.length === 0 ? (
        <div className={tableShell}>
          <EmptyState
            compact
            title="Nenhum resultado encontrado."
            description="Nenhuma avaliação concluída corresponde à busca ou aos filtros."
            action={<Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>}
          />
        </div>
      ) : (
        <div className={tableShell}>
          <table className="w-full text-body">
            <thead className="border-b border-wg-border-lighter bg-[#FAFCF6]">
              <tr>
                <th scope="col" className={thClass}>Candidato</th>
                <th scope="col" className={cn(thClass, 'hidden lg:table-cell')}>Vaga</th>
                <th scope="col" className={cn(thClass, 'hidden md:table-cell')}>Avaliação</th>
                <th scope="col" className={thClass}>Resultado</th>
                <th scope="col" className={cn(thClass, 'hidden sm:table-cell')}>Concluído em</th>
                <th scope="col" className={cn(thClass, 'w-10')}><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wg-border-lighter">
              {visible.map((s) => {
                const href = `/avaliacoes/resultados/${s.id}`
                return (
                  <tr key={s.id} className={cn(rowClass, 'group relative')}>
                    <td className={cn(tdClass, 'min-w-[170px]')}>
                      {/* O link cobre a linha inteira (::after), mantendo a tabela semântica. */}
                      <Link href={href} className="font-semibold text-wg-ink after:absolute after:inset-0 hover:underline">
                        {s.candidateName}
                      </Link>
                      <CellSub className="md:hidden">{s.templateName}</CellSub>
                      <CellSub className="hidden md:block lg:hidden">{s.jobTitle ?? s.candidateEmail}</CellSub>
                      <CellSub className="hidden lg:block">{s.candidateEmail}</CellSub>
                    </td>
                    <td className={cn(tdClass, 'hidden lg:table-cell text-wg-ink-secondary')}>
                      {s.jobTitle ?? <span className="text-wg-ink-muted">—</span>}
                    </td>
                    <td className={cn(tdClass, 'hidden md:table-cell')}>
                      <div className="text-wg-ink-secondary">{s.templateName}</div>
                      <CellSub>{ASSESSMENT_TYPE_LABEL[s.assessmentType]}</CellSub>
                    </td>
                    <td className={cn(tdClass, 'min-w-[150px]')}>
                      <ResultCell s={s} situation={s.situation} />
                    </td>
                    <td className={cn(tdClass, 'hidden sm:table-cell whitespace-nowrap tabular-nums text-wg-ink-secondary')}>
                      {s.submittedAt ? formatDate(s.submittedAt) : '—'}
                    </td>
                    <td className={cn(tdClass, 'text-right')}>
                      <ChevronRight className="ml-auto h-4 w-4 text-wg-ink-muted/60 transition-colors group-hover:text-wg-green-dark" aria-hidden />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
