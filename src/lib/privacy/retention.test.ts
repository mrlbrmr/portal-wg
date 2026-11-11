import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addMonths,
  anonymizedEmail,
  normalizeRetentionMonths,
  retentionCutoff,
  retentionStatus,
  type RetentionSubject,
} from './retention'

const NOW = new Date('2026-11-11T12:00:00.000Z')
const base: RetentionSubject = {
  anonimizadoEm: null,
  retencaoBloqueadaEm: null,
  processosAbertos: 0,
  contratado: false,
  temAdmissao: false,
  ultimaAtividadeEm: '2024-10-01T00:00:00.000Z',
  ultimaCandidaturaEm: null,
  createdAt: '2024-09-01T00:00:00.000Z',
}

describe('retenção LGPD', () => {
  it('normaliza o prazo dentro dos limites', () => {
    assert.equal(normalizeRetentionMonths(24), 24)
    assert.equal(normalizeRetentionMonths(1), 6)
    assert.equal(normalizeRetentionMonths(999), 120)
    assert.equal(normalizeRetentionMonths('abc'), 24)
  })

  it('soma meses ajustando o fim do mês', () => {
    assert.equal(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10), '2026-02-28')
    assert.equal(retentionCutoff(NOW, 24).toISOString().slice(0, 10), '2024-11-11')
  })

  it('é elegível quando parado além do prazo', () => {
    const r = retentionStatus(base, NOW, 24)
    assert.equal(r.eligible, true)
    assert.equal(r.reason, null)
  })

  it('não é elegível dentro do prazo', () => {
    const r = retentionStatus({ ...base, ultimaAtividadeEm: '2025-06-01T00:00:00Z' }, NOW, 24)
    assert.equal(r.reason, 'DENTRO_DO_PRAZO')
  })

  it('a candidatura mais recente conta como atividade', () => {
    const r = retentionStatus({ ...base, ultimaCandidaturaEm: '2026-05-01T00:00:00Z' }, NOW, 24)
    assert.equal(r.eligible, false)
  })

  it('bloqueios têm precedência sobre o prazo', () => {
    assert.equal(retentionStatus({ ...base, anonimizadoEm: '2026-01-01T00:00:00Z' }, NOW, 24).reason, 'ANONIMIZADO')
    assert.equal(retentionStatus({ ...base, retencaoBloqueadaEm: '2026-01-01T00:00:00Z' }, NOW, 24).reason, 'BLOQUEIO_JURIDICO')
    assert.equal(retentionStatus({ ...base, processosAbertos: 1 }, NOW, 24).reason, 'PROCESSO_ABERTO')
    assert.equal(retentionStatus({ ...base, contratado: true }, NOW, 24).reason, 'CONTRATADO')
    assert.equal(retentionStatus({ ...base, temAdmissao: true }, NOW, 24).reason, 'CONTRATADO')
  })

  it('e-mail anonimizado é único por id', () => {
    assert.notEqual(anonymizedEmail('a'), anonymizedEmail('b'))
    assert.ok(anonymizedEmail('a').endsWith('.invalid'))
  })
})
