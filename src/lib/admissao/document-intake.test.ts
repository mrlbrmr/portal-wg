// Avanço automático para a etapa de recebimento dos documentos: só para frente.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { documentIntakeMove, type IntakeStage } from './document-intake'

const stage = (id: string, sortOrder: number, extra: Partial<IntakeStage> = {}): IntakeStage => ({
  id,
  name: id,
  sortOrder,
  active: true,
  isFinal: false,
  isDocumentIntake: false,
  ...extra,
})

const STAGES = [
  stage('envio', 1),
  stage('validacao', 2, { isDocumentIntake: true }),
  stage('aso', 3),
  stage('concluida', 7, { isFinal: true }),
]

describe('documentIntakeMove', () => {
  it('etapa anterior avança para a etapa de recebimento', () => {
    const m = documentIntakeMove(STAGES, 'envio')
    assert.equal(m?.from?.id, 'envio')
    assert.equal(m?.to.id, 'validacao')
  })

  it('admissão sem etapa também avança', () => {
    const m = documentIntakeMove(STAGES, null)
    assert.equal(m?.from, null)
    assert.equal(m?.to.id, 'validacao')
  })

  it('já na etapa, depois dela ou concluída: não mexe', () => {
    assert.equal(documentIntakeMove(STAGES, 'validacao'), null)
    assert.equal(documentIntakeMove(STAGES, 'aso'), null)
    assert.equal(documentIntakeMove(STAGES, 'concluida'), null)
  })

  it('conclusão reordenada antes da etapa de recebimento continua intocada', () => {
    const stages = [stage('concluida', 1, { isFinal: true }), stage('validacao', 2, { isDocumentIntake: true })]
    assert.equal(documentIntakeMove(stages, 'concluida'), null)
  })

  it('sem etapa marcada ou etapa desativada: automação desligada', () => {
    assert.equal(documentIntakeMove(STAGES.map((s) => ({ ...s, isDocumentIntake: false })), 'envio'), null)
    assert.equal(
      documentIntakeMove(STAGES.map((s) => (s.isDocumentIntake ? { ...s, active: false } : s)), 'envio'),
      null
    )
  })

  it('etapa marcada que virou a de conclusão não conclui ninguém sozinha', () => {
    const stages = STAGES.map((s) => (s.isDocumentIntake ? { ...s, isFinal: true } : s))
    assert.equal(documentIntakeMove(stages, 'envio'), null)
  })

  it('etapa atual desconhecida: não mexe', () => {
    assert.equal(documentIntakeMove(STAGES, 'apagada'), null)
  })
})
