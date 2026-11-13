// Conferência do envio final no servidor (missingRequiredItems) e data de nascimento.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { birthDateProblem, missingRequiredItems, renewedFormExpiry, type DocumentConfig } from './form-config'

const documents: DocumentConfig[] = [
  { key: 'RG', label: 'RG/CNH', required: true, condition: { type: 'always' } },
  {
    key: 'CTPS', label: 'CTPS', required: true, condition: { type: 'always' },
    extraFields: [{ key: 'pis', label: 'Número do PIS', required: true, mask: 'pis' }],
  },
  { key: 'CONJUGE', label: 'RG do cônjuge', required: true, condition: { type: 'marital', values: ['Casado(a)'] } },
  { key: 'RESERVISTA', label: 'Reservista', required: false, condition: { type: 'gender', values: ['Masculino'] } },
]
const config = { documents }
const types = [
  { id: 't-rg', name: 'RG/CNH' },
  { id: 't-ctps', name: 'CTPS' },
  { id: 't-conj', name: 'RG do cônjuge' },
]
const solteiro = { gender: 'Masculino', maritalStatus: 'Solteiro(a)', hasChildren: false, hasItauAccount: false, isDriverOperator: false }

describe('missingRequiredItems', () => {
  it('sem nenhum anexo: aponta todos os obrigatórios visíveis e o PIS', () => {
    const r = missingRequiredItems(config, solteiro, types, [])
    assert.deepEqual(r.documents.map((d) => d.key), ['RG', 'CTPS'])
    assert.deepEqual(r.fields.map((f) => f.key), ['pis'])
  })

  it('completo: nada falta (opcional e condicional invisível não contam)', () => {
    const r = missingRequiredItems(config, solteiro, types, [
      { id: 'a1', fileName: 'rg.jpg', documentTypeId: 't-rg' },
      { id: 'a2', fileName: 'ctps.pdf', documentTypeId: 't-ctps' },
    ], { extras: { pis: '123.45678.90-1' } })
    assert.deepEqual(r, { documents: [], fields: [] })
  })

  it('condição muda o que é exigido (casado exige o documento do cônjuge)', () => {
    const r = missingRequiredItems(config, { ...solteiro, maritalStatus: 'Casado(a)' }, types, [
      { id: 'a1', fileName: 'rg.jpg', documentTypeId: 't-rg' },
      { id: 'a2', fileName: 'ctps.pdf', documentTypeId: 't-ctps' },
    ], { extras: { pis: '1' } })
    assert.deepEqual(r.documents.map((d) => d.key), ['CONJUGE'])
  })

  it('anexo recusado pelo RH ou descartado no envio não conta', () => {
    const r = missingRequiredItems(config, solteiro, types, [
      { id: 'a1', fileName: 'rg.jpg', documentTypeId: 't-rg', reviewStatus: 'rejected' },
      { id: 'a2', fileName: 'ctps.pdf', documentTypeId: 't-ctps' },
    ], { abandonedIds: ['a2'], extras: { pis: '1' } })
    assert.deepEqual(r.documents.map((d) => d.key), ['RG', 'CTPS'])
  })

  it('documento sem tipo no cadastro não bloqueia (não há como conferir)', () => {
    const r = missingRequiredItems(config, solteiro, types.filter((t) => t.id !== 't-rg'), [
      { id: 'a2', fileName: 'ctps.pdf', documentTypeId: 't-ctps' },
    ], { extras: { pis: '1' } })
    assert.deepEqual(r.documents, [])
  })
})

describe('birthDateProblem', () => {
  const today = new Date(2026, 10, 13) // 13/11/2026
  it('aceita idade plausível', () => assert.equal(birthDateProblem('2000-05-20', today), null))
  it('recusa data futura', () => assert.match(birthDateProblem('2027-01-01', today) ?? '', /futuro/))
  it('recusa menos de 14 anos (faz 14 amanhã)', () => assert.match(birthDateProblem('2012-11-14', today) ?? '', /14 anos/))
  it('aceita quem faz 14 hoje', () => assert.equal(birthDateProblem('2012-11-13', today), null))
  it('recusa formato inválido', () => assert.ok(birthDateProblem('13/11/2000', today)))
})

describe('renewedFormExpiry', () => {
  const now = new Date('2026-11-13T12:00:00Z')
  it('estende para 7 dias a partir de agora quando falta menos', () =>
    assert.equal(renewedFormExpiry('2026-11-14T12:00:00Z', now), '2026-11-20T12:00:00.000Z'))
  it('não encurta um prazo maior', () => assert.equal(renewedFormExpiry('2026-11-30T00:00:00Z', now), null))
  it('link sem prazo ganha prazo', () => assert.equal(renewedFormExpiry(null, now), '2026-11-20T12:00:00.000Z'))
})
