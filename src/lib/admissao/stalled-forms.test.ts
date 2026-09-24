// Aviso de formulário parado: só quem começou, parou há tempo e ainda não foi avisado.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isFormStalled, STALLED_FORM_HOURS, STALLED_FORM_MAX_DAYS } from './stalled-forms'

const NOW = new Date('2026-09-25T11:00:00.000Z')
const base = {
  submittedAt: null,
  hasToken: true,
  isFinal: false,
  lastUploadAt: '2026-09-24T15:56:30.000Z',
  lastNoticeAt: null,
}

describe('isFormStalled', () => {
  it('candidato que enviou documentos e parou entra no aviso', () => {
    assert.equal(isFormStalled(base, NOW), true)
  })

  it('formulário enviado, sem link, admissão concluída ou sem arquivos não entram', () => {
    assert.equal(isFormStalled({ ...base, submittedAt: '2026-09-24T16:00:00.000Z' }, NOW), false)
    assert.equal(isFormStalled({ ...base, hasToken: false }, NOW), false)
    assert.equal(isFormStalled({ ...base, isFinal: true }, NOW), false)
    assert.equal(isFormStalled({ ...base, lastUploadAt: null }, NOW), false)
  })

  it(`envio recente (menos de ${STALLED_FORM_HOURS}h) ainda é preenchimento em andamento`, () => {
    const recent = new Date(NOW.getTime() - (STALLED_FORM_HOURS * 3_600_000 - 60_000)).toISOString()
    assert.equal(isFormStalled({ ...base, lastUploadAt: recent }, NOW), false)
  })

  it(`parada com mais de ${STALLED_FORM_MAX_DAYS} dias não é avisada`, () => {
    const old = new Date(NOW.getTime() - (STALLED_FORM_MAX_DAYS * 86_400_000 + 60_000)).toISOString()
    assert.equal(isFormStalled({ ...base, lastUploadAt: old }, NOW), false)
  })

  it('avisa uma vez por parada', () => {
    assert.equal(isFormStalled({ ...base, lastNoticeAt: '2026-09-24T20:00:00.000Z' }, NOW), false)
    // Enviou algo depois do aviso e parou de novo: avisa outra vez.
    assert.equal(
      isFormStalled({ ...base, lastNoticeAt: '2026-09-24T12:00:00.000Z', lastUploadAt: '2026-09-24T18:00:00.000Z' }, NOW),
      true
    )
  })
})
