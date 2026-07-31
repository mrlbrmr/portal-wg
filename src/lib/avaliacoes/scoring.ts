import type { Question } from './schema'

export interface ScoringResult {
  score: number | null
  outcome: 'PASS' | 'FAIL' | 'PENDING_REVIEW'
  scoreBreakdown: Record<string, unknown>
}

// answers: { [questionId]: string }  (selected option text, "true"/"false", "1"-"5", or free text)
export function scoreSession(
  questions: Question[],
  answers: Record<string, string>,
  passingScore: number | null,
  kind: string,
): ScoringResult {
  // Big Five: dimensão-by-dimensão, sem PASS/FAIL
  if (kind === 'PERSONALITY_BIG5') {
    const buckets: Record<string, number[]> = { O: [], C: [], E: [], A: [], N: [] }
    for (const q of questions) {
      if (q.type !== 'SCALE_LIKERT' || !q.bigFiveDimension) continue
      const raw = parseInt(answers[q.id] ?? '', 10)
      if (isNaN(raw) || raw < 1 || raw > 5) continue
      const val = q.isReversed ? 6 - raw : raw
      buckets[q.bigFiveDimension].push(val)
    }
    const bigFive: Record<string, number | null> = {}
    for (const [dim, vals] of Object.entries(buckets)) {
      bigFive[dim] =
        vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length / 5) * 100)
          : null
    }
    return { score: null, outcome: 'PENDING_REVIEW', scoreBreakdown: { bigFive } }
  }

  // Triagem / Técnico: pontua MC e V/F automaticamente; SHORT_TEXT → revisão manual
  let totalWeight = 0
  let earnedWeight = 0
  let hasUngraded = false

  for (const q of questions) {
    if (q.type === 'SHORT_TEXT' || q.type === 'SCALE_LIKERT') {
      hasUngraded = true
      continue
    }
    const w = q.weight ?? 1
    totalWeight += w
    if (answers[q.id] !== undefined && answers[q.id] === q.correctAnswer) {
      earnedWeight += w
    }
  }

  if (totalWeight === 0 || hasUngraded) {
    return { score: null, outcome: 'PENDING_REVIEW', scoreBreakdown: {} }
  }

  const score = Math.round((earnedWeight / totalWeight) * 100)
  const passing = passingScore ?? 60
  const outcome: 'PASS' | 'FAIL' = score >= passing ? 'PASS' : 'FAIL'

  const breakdown = questions
    .filter((q) => q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE')
    .map((q) => ({
      id: q.id,
      correct: answers[q.id] === q.correctAnswer,
      given: answers[q.id] ?? null,
      expected: q.correctAnswer ?? null,
      weight: q.weight ?? 1,
    }))

  return { score, outcome, scoreBreakdown: { perQuestion: breakdown } }
}
