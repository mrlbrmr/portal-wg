"use client"

import { useState, useMemo } from 'react'
import { Search, X, ChevronRight, BarChart3, CheckCircle2, XCircle, Clock, User } from 'lucide-react'
import { BigFiveRadar, BigFiveBars, BigFiveMini, type BigFiveScores } from '@/components/internal/BigFiveChart'
import { formatDate } from '@/lib/utils'

export interface SessionRow {
  id: string
  score: number | null
  outcome: string | null
  scoreBreakdown: Record<string, unknown> | null
  submittedAt: string
  sentBy: string | null
  template: { name: string; kind: string } | null
  candidateName: string
  candidateEmail: string
  jobTitle: string
}

const KIND_LABELS: Record<string, string> = {
  PERSONALITY_BIG5: 'Big Five',
  TECHNICAL: 'Técnico',
  SCREENING: 'Triagem',
}
const KIND_COLORS: Record<string, string> = {
  PERSONALITY_BIG5: 'bg-purple-100 text-purple-700',
  TECHNICAL: 'bg-orange-100 text-orange-700',
  SCREENING: 'bg-blue-100 text-blue-700',
}

const OUTCOME_LABELS: Record<string, string> = {
  PASS: 'Aprovado',
  FAIL: 'Reprovado',
  PENDING_REVIEW: 'Revisão pendente',
}
const OUTCOME_COLORS: Record<string, string> = {
  PASS: 'text-emerald-600',
  FAIL: 'text-red-600',
  PENDING_REVIEW: 'text-amber-600',
}

function OutcomeIcon({ outcome }: { outcome: string | null }) {
  if (outcome === 'PASS') return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
  if (outcome === 'FAIL') return <XCircle className="h-4 w-4 text-red-500 shrink-0" />
  return <Clock className="h-4 w-4 text-amber-500 shrink-0" />
}

function bigFiveScores(breakdown: Record<string, unknown> | null): BigFiveScores | null {
  const bf = (breakdown as { bigFive?: Record<string, number | null> } | null)?.bigFive
  if (!bf) return null
  return { O: bf.O ?? null, C: bf.C ?? null, E: bf.E ?? null, A: bf.A ?? null, N: bf.N ?? null }
}

function perQuestionStats(breakdown: Record<string, unknown> | null) {
  const pq = (breakdown as { perQuestion?: Array<{ correct: boolean }> } | null)?.perQuestion
  if (!pq || pq.length === 0) return null
  return { correct: pq.filter((q) => q.correct).length, total: pq.length }
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function DetailModal({ session, onClose }: { session: SessionRow; onClose: () => void }) {
  const kind = session.template?.kind ?? ''
  const bf = bigFiveScores(session.scoreBreakdown)
  const pq = perQuestionStats(session.scoreBreakdown)
  const isBigFive = kind === 'PERSONALITY_BIG5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${KIND_COLORS[kind] ?? 'bg-gray-100 text-gray-700'}`}>
                {KIND_LABELS[kind] ?? kind}
              </span>
              {session.outcome && (
                <span className={`text-xs font-semibold flex items-center gap-1 ${OUTCOME_COLORS[session.outcome] ?? 'text-gray-600'}`}>
                  <OutcomeIcon outcome={session.outcome} />
                  {OUTCOME_LABELS[session.outcome] ?? session.outcome}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-gray-900">{session.template?.name ?? 'Avaliação'}</h2>
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-500">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-gray-700">{session.candidateName}</span>
              <span className="text-gray-300">·</span>
              <span>{session.jobTitle}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {isBigFive && bf ? (
            <div>
              <p className="text-xs text-gray-400 mb-4">
                Modelo IPIP-50 · 50 questões · Escala Likert 1-5. Os percentuais indicam o posicionamento relativo em cada dimensão.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <div className="shrink-0 mx-auto sm:mx-0">
                  <BigFiveRadar scores={bf} size={260} />
                </div>
                <div className="flex-1 w-full">
                  <BigFiveBars scores={bf} />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {session.score !== null && (
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-sm text-gray-600 font-medium">Pontuação</span>
                    <span className="text-3xl font-bold text-gray-900">
                      {session.score}
                      <span className="text-base font-normal text-gray-400">/100</span>
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        session.outcome === 'PASS'
                          ? 'bg-emerald-500'
                          : session.outcome === 'FAIL'
                          ? 'bg-red-400'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${session.score}%` }}
                    />
                  </div>
                </div>
              )}

              {pq && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex gap-8">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-600">{pq.correct}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Corretas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">{pq.total - pq.correct}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Incorretas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{pq.total}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Total</div>
                  </div>
                </div>
              )}

              {session.outcome === 'PENDING_REVIEW' && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 border border-amber-200">
                  Este teste contém questões dissertativas que precisam de correção manual.
                </p>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
            {session.sentBy && (
              <span>Enviado por: <span className="text-gray-600 font-medium">{session.sentBy}</span></span>
            )}
            <span>Concluído em: <span className="text-gray-600 font-medium">{formatDate(session.submittedAt)}</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface Props {
  sessions: SessionRow[]
  isAdmin: boolean
}

export function ResultadosClient({ sessions }: Props) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('ALL')
  const [outcomeFilter, setOutcomeFilter] = useState('ALL')
  const [selected, setSelected] = useState<SessionRow | null>(null)

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !s.candidateName.toLowerCase().includes(q) &&
          !s.candidateEmail.toLowerCase().includes(q) &&
          !s.jobTitle.toLowerCase().includes(q) &&
          !(s.template?.name ?? '').toLowerCase().includes(q)
        )
          return false
      }
      if (kindFilter !== 'ALL' && s.template?.kind !== kindFilter) return false
      if (outcomeFilter !== 'ALL' && s.outcome !== outcomeFilter) return false
      return true
    })
  }, [sessions, search, kindFilter, outcomeFilter])

  const hasFilter = search !== '' || kindFilter !== 'ALL' || outcomeFilter !== 'ALL'

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Candidato, vaga ou teste…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
          />
        </div>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
        >
          <option value="ALL">Todos os tipos</option>
          <option value="PERSONALITY_BIG5">Big Five</option>
          <option value="TECHNICAL">Técnico</option>
          <option value="SCREENING">Triagem</option>
        </select>
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
        >
          <option value="ALL">Todos os resultados</option>
          <option value="PASS">Aprovado</option>
          <option value="FAIL">Reprovado</option>
          <option value="PENDING_REVIEW">Revisão pendente</option>
        </select>
        {hasFilter && (
          <button
            type="button"
            onClick={() => { setSearch(''); setKindFilter('ALL'); setOutcomeFilter('ALL') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors inline-flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </button>
        )}
      </div>

      {hasFilter && (
        <p className="text-xs text-gray-500 mb-3">
          {filtered.length} de {sessions.length} resultado{sessions.length !== 1 ? 's' : ''}
        </p>
      )}

      {sessions.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
          <BarChart3 className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Nenhuma avaliação concluída ainda</p>
          <p className="text-xs text-gray-400 mt-1">Os resultados aparecem aqui quando candidatos enviarem os testes.</p>
        </div>
      )}

      {sessions.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">Nenhum resultado para os filtros aplicados.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-x-auto bg-white">
          {/* Table header — desktop only */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_160px_110px_32px] gap-4 px-4 py-2.5 bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Candidato</span>
            <span>Vaga / Teste</span>
            <span>Resultado</span>
            <span>Data</span>
            <span />
          </div>

          <ul className="divide-y divide-slate-100">
            {filtered.map((s) => {
              const kind = s.template?.kind ?? ''
              const bf = bigFiveScores(s.scoreBreakdown)

              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="md:grid md:grid-cols-[1fr_1fr_160px_110px_32px] md:gap-4 md:items-center">
                      {/* Candidato */}
                      <div className="min-w-0 mb-1 md:mb-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.candidateName}</p>
                        <p className="text-xs text-gray-400 truncate">{s.candidateEmail}</p>
                      </div>

                      {/* Vaga / Teste */}
                      <div className="min-w-0 mb-1 md:mb-0">
                        <p className="text-xs text-gray-500 truncate mb-0.5">{s.jobTitle}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 shrink-0 ${KIND_COLORS[kind] ?? 'bg-gray-100 text-gray-600'}`}>
                            {KIND_LABELS[kind] ?? kind}
                          </span>
                          <span className="text-xs text-gray-600 truncate">{s.template?.name}</span>
                        </div>
                      </div>

                      {/* Resultado */}
                      <div className="mb-1 md:mb-0">
                        {kind === 'PERSONALITY_BIG5' && bf ? (
                          <BigFiveMini scores={bf} />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <OutcomeIcon outcome={s.outcome} />
                            <span className={`text-xs font-semibold ${OUTCOME_COLORS[s.outcome ?? ''] ?? 'text-gray-600'}`}>
                              {s.outcome ? (OUTCOME_LABELS[s.outcome] ?? s.outcome) : '—'}
                            </span>
                            {s.score !== null && (
                              <span className="text-xs text-gray-400">{s.score}/100</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Data */}
                      <div className="text-xs text-gray-400 mb-1 md:mb-0">
                        {formatDate(s.submittedAt)}
                      </div>

                      {/* Arrow */}
                      <div className="hidden md:flex justify-end">
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {selected && <DetailModal session={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
