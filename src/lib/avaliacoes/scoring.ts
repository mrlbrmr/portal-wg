import { DEFAULT_PASSING_SCORE, isManualQuestion, type AssessmentType, type Question } from './schema'

/**
 * Pontuação de uma sessão de avaliação — módulo PURO (sem banco), usado pelo envio público
 * (`/api/avaliacao/[token]/submit`) e pela correção manual do RH
 * (`/api/assessment-sessions/[id]/grade`). Testes: scoring.test.ts.
 *
 * Regras por tipo:
 * - BEHAVIORAL (Big Five): calcula o perfil por dimensão. SEM nota, SEM outcome — não há
 *   aprovação, reprovação nem correção. O resultado fica disponível na hora.
 * - TECHNICAL_OBJECTIVE: corrige tudo automaticamente → nota + PASS/FAIL no critério.
 * - TECHNICAL_MIXED: corrige as objetivas; enquanto houver dissertativa sem nota o outcome
 *   é PENDING_REVIEW ("Aguardando correção") com resultado parcial. Quando o RH informa os
 *   pontos de todas as dissertativas, vira nota final + PASS/FAIL.
 */

export type SessionOutcome = 'PASS' | 'FAIL' | 'PENDING_REVIEW'

export interface ObjectiveItem {
  id: string
  correct: boolean
  given: string | null
  expected: string | null
  weight: number
}

export interface ManualItem {
  id: string
  weight: number
  given: string | null
  /** Pontos atribuídos na correção (0..weight); null = ainda não corrigida. */
  points: number | null
}

export interface ScoreBreakdown {
  bigFive?: Record<string, number | null>
  perQuestion?: ObjectiveItem[]
  manual?: ManualItem[]
  /** Pontos (pesos) obtidos nas objetivas / total possível nas objetivas. */
  objectiveEarned?: number
  objectiveTotal?: number
  /** Total possível nas questões de correção manual. */
  manualTotal?: number
}

export interface ScoringResult {
  score: number | null
  outcome: SessionOutcome | null
  scoreBreakdown: ScoreBreakdown
}

/** answers: { [questionId]: string } — opção escolhida, "true"/"false", "1"–"5" ou texto livre. */
export function scoreSession(
  questions: Question[],
  answers: Record<string, string>,
  passingScore: number | null,
  assessmentType: AssessmentType,
  /** Pontos da correção manual por questão (só testes técnicos mistos). */
  manualGrades?: Record<string, number>,
): ScoringResult {
  if (assessmentType === 'BEHAVIORAL') {
    return { score: null, outcome: null, scoreBreakdown: { bigFive: bigFiveProfile(questions, answers) } }
  }

  const perQuestion: ObjectiveItem[] = []
  const manual: ManualItem[] = []
  let objectiveEarned = 0
  let objectiveTotal = 0
  let manualTotal = 0

  for (const q of questions) {
    const w = q.weight ?? 1
    const given = answers[q.id] ?? null
    if (isManualQuestion(q)) {
      manualTotal += w
      const raw = manualGrades?.[q.id]
      const points = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(Math.max(raw, 0), w) : null
      manual.push({ id: q.id, weight: w, given, points })
      continue
    }
    const correct = given !== null && given === q.correctAnswer
    objectiveTotal += w
    if (correct) objectiveEarned += w
    perQuestion.push({ id: q.id, correct, given, expected: q.correctAnswer ?? null, weight: w })
  }

  const scoreBreakdown: ScoreBreakdown = { perQuestion, objectiveEarned, objectiveTotal }
  if (manual.length > 0) {
    scoreBreakdown.manual = manual
    scoreBreakdown.manualTotal = manualTotal
  }

  const total = objectiveTotal + manualTotal
  if (total === 0) return { score: null, outcome: null, scoreBreakdown }

  if (manual.some((m) => m.points === null)) {
    return { score: null, outcome: 'PENDING_REVIEW', scoreBreakdown }
  }

  const earned = objectiveEarned + manual.reduce((s, m) => s + (m.points ?? 0), 0)
  const score = Math.round((earned / total) * 100)
  const outcome: SessionOutcome = score >= (passingScore ?? DEFAULT_PASSING_SCORE) ? 'PASS' : 'FAIL'
  return { score, outcome, scoreBreakdown }
}

/**
 * Big Five: média das respostas Likert (1–5, itens invertidos já corrigidos) por dimensão,
 * convertida para 0–100 (média ÷ 5 × 100). NÃO é percentil — não há comparação com uma
 * população de referência. Faixa efetiva: 20 (tudo "1") a 100 (tudo "5"); 60 = neutro.
 */
export function bigFiveProfile(questions: Question[], answers: Record<string, string>): Record<string, number | null> {
  const buckets: Record<string, number[]> = { O: [], C: [], E: [], A: [], N: [] }
  for (const q of questions) {
    if (q.type !== 'SCALE_LIKERT' || !q.bigFiveDimension) continue
    const raw = parseInt(answers[q.id] ?? '', 10)
    if (isNaN(raw) || raw < 1 || raw > 5) continue
    buckets[q.bigFiveDimension].push(q.isReversed ? 6 - raw : raw)
  }
  const out: Record<string, number | null> = {}
  for (const [dim, vals] of Object.entries(buckets)) {
    out[dim] = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length / 5) * 100) : null
  }
  return out
}
