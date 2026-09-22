import type { Tone } from '@/components/ui/StatusBadge'
import { DEFAULT_PASSING_SCORE, SUBTYPE_LABELS, type AssessmentType, type GradingMode } from './schema'

/**
 * Apresentação do módulo de Avaliações — módulo PURO que decide rótulos, status e
 * situação a partir do TIPO da avaliação (nunca do nome do teste). Banco de testes,
 * Aplicações, Resultados, Quick View e Kanban consultam as mesmas funções, então o
 * vocabulário é um só em todo o portal. Testes: presentation.test.ts.
 *
 * Vocabulário padronizado:
 *   Teste técnico · Avaliação comportamental · Resultado disponível · Aguardando correção
 *   ("correção" — nunca "revisão" — para dissertativas; comportamental nunca é corrigido).
 */

export const ASSESSMENT_TYPE_LABEL: Record<AssessmentType, string> = {
  TECHNICAL_OBJECTIVE: 'Teste técnico',
  TECHNICAL_MIXED: 'Teste técnico',
  BEHAVIORAL: 'Avaliação comportamental',
}

/** Rótulo curto (coluna "Tipo", filtros). */
export const ASSESSMENT_TYPE_SHORT: Record<AssessmentType, string> = {
  TECHNICAL_OBJECTIVE: 'Técnico',
  TECHNICAL_MIXED: 'Técnico',
  BEHAVIORAL: 'Comportamental',
}

export const ASSESSMENT_TYPE_DETAIL: Record<AssessmentType, string> = {
  TECHNICAL_OBJECTIVE: 'Teste técnico objetivo',
  TECHNICAL_MIXED: 'Teste técnico com questões dissertativas',
  BEHAVIORAL: 'Avaliação comportamental',
}

export const GRADING_MODE_LABEL: Record<GradingMode, string> = {
  AUTO: 'Correção automática',
  HYBRID: 'Objetivas corrigidas automaticamente; dissertativas corrigidas pelo RH',
  MANUAL: 'Correção manual pelo RH',
  NONE: 'Sem correção — o resultado é um perfil, disponível ao concluir',
}

export function isBehavioral(type: AssessmentType): boolean {
  return type === 'BEHAVIORAL'
}

/** Categoria exibida no Banco de testes: "Técnico · Excel", "Comportamental · Big Five". */
export function templateCategory(kind: string, subtype: string | null): { primary: string; secondary: string | null } {
  if (kind === 'PERSONALITY_BIG5') return { primary: 'Comportamental', secondary: 'Big Five' }
  const primary = kind === 'SCREENING' ? 'Triagem' : 'Técnico'
  return { primary, secondary: subtype ? (SUBTYPE_LABELS[subtype] ?? subtype) : null }
}

/** Coluna "Critério": nota mínima (técnico) ou "Perfil dimensional" (comportamental). */
export function criterionLabel(type: AssessmentType, passingScore: number | null): string {
  if (isBehavioral(type)) return 'Perfil dimensional'
  return `≥ ${passingScore ?? DEFAULT_PASSING_SCORE}%`
}

/** "12 questões" / "50 itens" + detalhe ("Escala Likert 1–5", "1 dissertativa"). */
export function itemsLabel(
  type: AssessmentType,
  questions: ReadonlyArray<{ type: string }>,
): { count: string; detail: string | null } {
  const n = questions.length
  if (isBehavioral(type)) {
    const allLikert = n > 0 && questions.every((q) => q.type === 'SCALE_LIKERT')
    return { count: `${n} ${n === 1 ? 'item' : 'itens'}`, detail: allLikert ? 'Escala Likert 1–5' : null }
  }
  const essays = questions.filter((q) => q.type === 'SHORT_TEXT').length
  return {
    count: `${n} ${n === 1 ? 'questão' : 'questões'}`,
    detail: essays > 0 ? `${essays} ${essays === 1 ? 'dissertativa' : 'dissertativas'}` : null,
  }
}

// ─── Aplicações (acompanhamento do envio) ──────────────────────────────────────────

export type ApplicationStatusKey =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'AWAITING_GRADING'
  | 'EXPIRED'
  | 'INVALIDATED'

export interface SessionStateInput {
  submittedAt: string | null
  startedAt: string | null
  expiresAt: string | null
  outcome: string | null
  invalidadoEm?: string | null
}

export const APPLICATION_STATUS: Record<ApplicationStatusKey, { label: string; tone: Tone; hint: string }> = {
  NOT_STARTED: { label: 'Não iniciado', tone: 'neutral', hint: 'Link enviado; o candidato ainda não começou a responder.' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'info', hint: 'O candidato começou a responder e ainda não enviou.' },
  COMPLETED: { label: 'Concluído', tone: 'success', hint: 'Respondido — o resultado está disponível.' },
  AWAITING_GRADING: { label: 'Aguardando correção', tone: 'warning', hint: 'Há questões dissertativas para o RH corrigir.' },
  EXPIRED: { label: 'Expirado', tone: 'danger', hint: 'O prazo do link venceu sem resposta.' },
  INVALIDATED: { label: 'Invalidado', tone: 'neutral', hint: 'Aplicação invalidada pelo RH.' },
}

/**
 * Status da aplicação. "Aguardando correção" só existe para teste técnico com questão
 * manual ainda sem nota; para avaliação comportamental "Concluído" = resultado disponível.
 */
export function applicationStatus(
  s: SessionStateInput,
  type: AssessmentType,
  now: Date = new Date(),
): ApplicationStatusKey {
  if (s.invalidadoEm) return 'INVALIDATED'
  if (s.submittedAt) {
    return !isBehavioral(type) && s.outcome === 'PENDING_REVIEW' ? 'AWAITING_GRADING' : 'COMPLETED'
  }
  if (s.expiresAt && new Date(s.expiresAt) < now) return 'EXPIRED'
  if (s.startedAt) return 'IN_PROGRESS'
  return 'NOT_STARTED'
}

// ─── Resultados (avaliações concluídas) ────────────────────────────────────────────

export type ResultSituation = 'ABOVE' | 'BELOW' | 'AWAITING_GRADING' | 'PROFILE' | 'NO_SCORE'

export const RESULT_SITUATION: Record<ResultSituation, { label: string; tone: Tone }> = {
  ABOVE: { label: 'Aprovado no critério', tone: 'success' },
  BELOW: { label: 'Abaixo do critério', tone: 'neutral' },
  AWAITING_GRADING: { label: 'Aguardando correção', tone: 'warning' },
  PROFILE: { label: 'Resultado disponível', tone: 'success' },
  NO_SCORE: { label: 'Concluído', tone: 'neutral' },
}

export function resultSituation(s: { outcome: string | null }, type: AssessmentType): ResultSituation {
  if (isBehavioral(type)) return 'PROFILE'
  if (s.outcome === 'PENDING_REVIEW') return 'AWAITING_GRADING'
  if (s.outcome === 'PASS') return 'ABOVE'
  if (s.outcome === 'FAIL') return 'BELOW'
  return 'NO_SCORE'
}

// ─── Tempo ──────────────────────────────────────────────────────────────────────────

/**
 * Tempo de preenchimento: do primeiro item respondido (`startedAt`) ao envio. Sessões
 * antigas gravavam `startedAt` = `submittedAt` — sem duração real, então retorna null.
 */
export function fillDurationMs(startedAt: string | null, submittedAt: string | null): number | null {
  if (!startedAt || !submittedAt) return null
  const ms = new Date(submittedAt).getTime() - new Date(startedAt).getTime()
  return ms >= 1000 ? ms : null
}

/** 522000 → "08min 42s"; 3900000 → "1h 05min". */
export function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${h}h ${pad(m)}min`
  return `${pad(m)}min ${pad(s)}s`
}
