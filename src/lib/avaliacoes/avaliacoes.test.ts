// Testes do módulo de Avaliações: classificação do tipo, pontuação/correção e apresentação.
//
// O requisito central: avaliação COMPORTAMENTAL (Big Five) nunca tem nota, aprovação,
// reprovação nem "aguardando correção" — o resultado fica disponível ao concluir. Teste
// técnico com dissertativa fica "Aguardando correção" até o RH pontuar cada uma.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyTemplate, resolveAssessmentType, type Question } from './schema'
import { scoreSession } from './scoring'
import {
  applicationStatus,
  criterionLabel,
  fillDurationMs,
  formatDuration,
  itemsLabel,
  resultSituation,
} from './presentation'
import { bigFiveBand, interviewPrompts, salientDimensions } from './big-five'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const mc = (n: number, correct = 'A', weight = 1): Question => ({
  id: id(n), type: 'MULTIPLE_CHOICE', text: `Q${n}`, options: ['A', 'B'], correctAnswer: correct, weight,
})
const essay = (n: number, weight = 1): Question => ({ id: id(n), type: 'SHORT_TEXT', text: `D${n}`, weight })
const likert = (n: number, dim: 'O' | 'C' | 'E' | 'A' | 'N', isReversed = false): Question => ({
  id: id(n), type: 'SCALE_LIKERT', text: `L${n}`, bigFiveDimension: dim, isReversed, weight: 1,
})

describe('classifyTemplate', () => {
  it('Big Five é comportamental, sem correção', () => {
    assert.deepEqual(classifyTemplate('PERSONALITY_BIG5', [likert(1, 'O')]), {
      assessmentType: 'BEHAVIORAL', gradingMode: 'NONE',
    })
  })
  it('só objetivas → técnico objetivo, correção automática', () => {
    assert.deepEqual(classifyTemplate('TECHNICAL', [mc(1), mc(2)]), {
      assessmentType: 'TECHNICAL_OBJECTIVE', gradingMode: 'AUTO',
    })
  })
  it('objetivas + dissertativa → técnico misto, correção híbrida', () => {
    assert.deepEqual(classifyTemplate('TECHNICAL', [mc(1), essay(2)]), {
      assessmentType: 'TECHNICAL_MIXED', gradingMode: 'HYBRID',
    })
  })
  it('só dissertativas → correção manual', () => {
    assert.equal(classifyTemplate('SCREENING', [essay(1)]).gradingMode, 'MANUAL')
  })
  it('coluna do banco tem precedência; ausente cai na regra', () => {
    assert.equal(resolveAssessmentType({ assessmentType: 'TECHNICAL_MIXED', kind: 'TECHNICAL', questions: [] }), 'TECHNICAL_MIXED')
    assert.equal(resolveAssessmentType({ assessmentType: null, kind: 'PERSONALITY_BIG5' }), 'BEHAVIORAL')
  })
})

describe('scoreSession', () => {
  it('comportamental: perfil por dimensão, sem nota e sem outcome', () => {
    const qs = [likert(1, 'C'), likert(2, 'C', true), likert(3, 'N')]
    const r = scoreSession(qs, { [id(1)]: '5', [id(2)]: '1', [id(3)]: '2' }, 70, 'BEHAVIORAL')
    assert.equal(r.score, null)
    assert.equal(r.outcome, null)
    assert.equal(r.scoreBreakdown.bigFive?.C, 100) // 5 e (6-1)=5 → média 5 → 100
    assert.equal(r.scoreBreakdown.bigFive?.N, 40)
    assert.equal(r.scoreBreakdown.bigFive?.O, null)
  })

  it('técnico objetivo: nota e aprovação no critério', () => {
    const qs = [mc(1), mc(2), mc(3, 'A', 2)]
    const r = scoreSession(qs, { [id(1)]: 'A', [id(2)]: 'B', [id(3)]: 'A' }, 70, 'TECHNICAL_OBJECTIVE')
    assert.equal(r.score, 75)
    assert.equal(r.outcome, 'PASS')
    const low = scoreSession(qs, { [id(1)]: 'A' }, 70, 'TECHNICAL_OBJECTIVE')
    assert.equal(low.score, 25)
    assert.equal(low.outcome, 'FAIL')
  })

  it('sem nota mínima usa o padrão de 60%', () => {
    const r = scoreSession([mc(1), mc(2), mc(3)], { [id(1)]: 'A', [id(2)]: 'A' }, null, 'TECHNICAL_OBJECTIVE')
    assert.equal(r.score, 67)
    assert.equal(r.outcome, 'PASS')
  })

  it('técnico misto: aguardando correção com resultado parcial das objetivas', () => {
    const qs = [mc(1), mc(2), essay(3, 2)]
    const r = scoreSession(qs, { [id(1)]: 'A', [id(2)]: 'B', [id(3)]: 'texto' }, 70, 'TECHNICAL_MIXED')
    assert.equal(r.outcome, 'PENDING_REVIEW')
    assert.equal(r.score, null)
    assert.equal(r.scoreBreakdown.objectiveEarned, 1)
    assert.equal(r.scoreBreakdown.objectiveTotal, 2)
    assert.equal(r.scoreBreakdown.manualTotal, 2)
    assert.deepEqual(r.scoreBreakdown.manual, [{ id: id(3), weight: 2, given: 'texto', points: null }])
  })

  it('técnico misto corrigido: nota final soma objetivas + pontos manuais', () => {
    const qs = [mc(1), mc(2), essay(3, 2)]
    const answers = { [id(1)]: 'A', [id(2)]: 'B', [id(3)]: 'texto' }
    const r = scoreSession(qs, answers, 70, 'TECHNICAL_MIXED', { [id(3)]: 2 })
    assert.equal(r.score, 75) // (1 + 2) / 4
    assert.equal(r.outcome, 'PASS')
    // Pontos acima do peso são limitados ao peso.
    assert.equal(scoreSession(qs, answers, 70, 'TECHNICAL_MIXED', { [id(3)]: 9 }).score, 75)
    // Correção parcial (faltando questão) continua aguardando.
    const partial = scoreSession([...qs, essay(4)], answers, 70, 'TECHNICAL_MIXED', { [id(3)]: 1 })
    assert.equal(partial.outcome, 'PENDING_REVIEW')
  })
})

describe('apresentação', () => {
  const done = { submittedAt: '2026-09-03T10:00:00Z', startedAt: null, expiresAt: null }

  it('comportamental concluído nunca fica "aguardando correção"', () => {
    // Mesmo com o outcome legado PENDING_REVIEW gravado antes da migração.
    assert.equal(applicationStatus({ ...done, outcome: 'PENDING_REVIEW' }, 'BEHAVIORAL'), 'COMPLETED')
    assert.equal(resultSituation({ outcome: 'PENDING_REVIEW' }, 'BEHAVIORAL'), 'PROFILE')
    assert.equal(resultSituation({ outcome: 'PASS' }, 'BEHAVIORAL'), 'PROFILE')
  })

  it('técnico com dissertativa pendente → aguardando correção', () => {
    assert.equal(applicationStatus({ ...done, outcome: 'PENDING_REVIEW' }, 'TECHNICAL_MIXED'), 'AWAITING_GRADING')
    assert.equal(resultSituation({ outcome: 'PENDING_REVIEW' }, 'TECHNICAL_MIXED'), 'AWAITING_GRADING')
    assert.equal(resultSituation({ outcome: 'PASS' }, 'TECHNICAL_OBJECTIVE'), 'ABOVE')
    assert.equal(resultSituation({ outcome: 'FAIL' }, 'TECHNICAL_OBJECTIVE'), 'BELOW')
  })

  it('status de envio: não iniciado, em andamento, expirado, invalidado', () => {
    const now = new Date('2026-09-10T00:00:00Z')
    const base = { submittedAt: null, startedAt: null, expiresAt: null, outcome: null }
    assert.equal(applicationStatus(base, 'BEHAVIORAL', now), 'NOT_STARTED')
    assert.equal(applicationStatus({ ...base, startedAt: '2026-09-09T00:00:00Z' }, 'BEHAVIORAL', now), 'IN_PROGRESS')
    assert.equal(applicationStatus({ ...base, expiresAt: '2026-09-05T00:00:00Z' }, 'BEHAVIORAL', now), 'EXPIRED')
    assert.equal(applicationStatus({ ...base, invalidadoEm: '2026-09-05T00:00:00Z' }, 'BEHAVIORAL', now), 'INVALIDATED')
  })

  it('critério e itens por tipo', () => {
    assert.equal(criterionLabel('BEHAVIORAL', null), 'Perfil dimensional')
    assert.equal(criterionLabel('TECHNICAL_OBJECTIVE', 70), '≥ 70%')
    assert.equal(criterionLabel('TECHNICAL_MIXED', null), '≥ 60%')
    assert.deepEqual(itemsLabel('BEHAVIORAL', [likert(1, 'O'), likert(2, 'C')]), { count: '2 itens', detail: 'Escala Likert 1–5' })
    assert.deepEqual(itemsLabel('TECHNICAL_MIXED', [mc(1), essay(2)]), { count: '2 questões', detail: '1 dissertativa' })
  })

  it('tempo de preenchimento: ignora sessões legadas sem duração real', () => {
    assert.equal(fillDurationMs('2026-09-03T10:00:00Z', '2026-09-03T10:00:00Z'), null)
    assert.equal(fillDurationMs('2026-09-03T10:00:00Z', '2026-09-03T10:08:42Z'), 522_000)
    assert.equal(formatDuration(522_000), '08min 42s')
    assert.equal(formatDuration(3_900_000), '1h 05min')
  })
})

describe('Big Five', () => {
  it('faixas pela média da escala', () => {
    assert.equal(bigFiveBand(92), 'HIGH')
    assert.equal(bigFiveBand(70), 'HIGH')
    assert.equal(bigFiveBand(60), 'MODERATE')
    assert.equal(bigFiveBand(49), 'LOW')
  })

  it('dimensões salientes e pontos de entrevista partem do ponto neutro', () => {
    const scores = { O: 80, C: 92, E: 60, A: 82, N: 32 }
    assert.deepEqual(salientDimensions(scores, 2).map((d) => d.info.key), ['C', 'N'])
    const prompts = interviewPrompts(scores, 3)
    assert.deepEqual(prompts.map((p) => p.title), ['Conscienciosidade elevada', 'Neuroticismo baixo', 'Amabilidade elevada'])
  })
})
