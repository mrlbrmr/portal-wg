// Conferência do envio final no servidor (missingRequiredItems) e data de nascimento.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { birthDateProblem, DEFAULT_FORM_CONFIG, FormConfigSchema, getVisibleDocuments, matchesCondition, missingRequiredItems, renewedFormExpiry, resolvePositionAnswers, type DocumentConfig } from './form-config'

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

describe('resolvePositionAnswers (o cargo define uniforme e motorista/operador)', () => {
  const motorista = { usesOperationalUniform: true, isDriver: true, isForkliftOperator: false }
  const nada = { usesOperationalUniform: false, isDriver: false, isForkliftOperator: false }

  it('com cargo motorista: não pergunta e usa o cargo', () => {
    const r = resolvePositionAnswers(motorista, { isDriverOperator: false, noOperationalUniform: true })
    assert.deepEqual(r, {
      isDriverOperator: true, isDriver: true, isForkliftOperator: false, noOperationalUniform: false,
      asksDriverQuestion: false, asksUniformQuestion: false,
    })
  })

  it('cargo sem nenhuma marcação: sem calça e bota e não é motorista/operador', () => {
    const r = resolvePositionAnswers(nada, { isDriverOperator: true, noOperationalUniform: false })
    assert.equal(r.noOperationalUniform, true)
    assert.equal(r.isDriverOperator, false)
  })

  it('sem cargo: repete a resposta do candidato e continua perguntando', () => {
    const r = resolvePositionAnswers(null, { isDriverOperator: true, noOperationalUniform: false })
    assert.deepEqual(r, {
      isDriverOperator: true, noOperationalUniform: false, asksDriverQuestion: true, asksUniformQuestion: true,
    })
  })
})

describe('condições do cargo nos documentos', () => {
  const docs: DocumentConfig[] = [
    { key: 'MOPP', label: 'MOPP', required: true, condition: { type: 'positionDriver' } },
    { key: 'EMP', label: 'Empilhadeira', required: true, condition: { type: 'positionForkliftOperator' } },
  ]
  const docTypes = [{ id: 't-mopp', name: 'MOPP' }, { id: 't-emp', name: 'Empilhadeira' }]

  it('operador não precisa de MOPP; motorista precisa', () => {
    const operador = missingRequiredItems({ documents: docs }, { isDriver: false, isForkliftOperator: true }, docTypes, [])
    assert.deepEqual(operador.documents.map((d) => d.key), ['EMP'])
    const motorista = missingRequiredItems({ documents: docs }, { isDriver: true, isForkliftOperator: false }, docTypes, [])
    assert.deepEqual(motorista.documents.map((d) => d.key), ['MOPP'])
  })

  it('sem cargo, as condições novas caem na resposta motorista/operador do candidato', () => {
    assert.equal(matchesCondition({ type: 'positionDriver' }, { isDriverOperator: true }), true)
    assert.equal(matchesCondition({ type: 'positionForkliftOperator' }, { isDriverOperator: false }), false)
  })

  it('configuração antiga com isDriverOperator continua funcionando', () => {
    assert.equal(matchesCondition({ type: 'isDriverOperator' }, { isDriverOperator: true }), true)
    assert.equal(matchesCondition({ type: 'isDriverOperator' }, { isDriverOperator: false }), false)
  })
})

describe('FormConfigSchema aceita as condições do cargo', () => {
  it('a configuração padrão passa pela validação do editor (salvar não pode falhar)', () => {
    assert.equal(FormConfigSchema.safeParse(DEFAULT_FORM_CONFIG).success, true)
  })
})

describe('documento do cônjuge', () => {
  it('é pedido também em União Estável, como a certidão', () => {
    const visible = (marital: string) =>
      getVisibleDocuments(DEFAULT_FORM_CONFIG, { maritalStatus: marital }).map((d) => d.key)
    assert.ok(visible('União Estável').includes('RG_CNH_CONJUGE'))
    assert.ok(visible('Casado(a)').includes('RG_CNH_CONJUGE'))
    assert.ok(!visible('Solteiro(a)').includes('RG_CNH_CONJUGE'))
  })
})

describe('documentos condicionais obrigatórios (decisão de 2026-11-13)', () => {
  const required = (key: string) => DEFAULT_FORM_CONFIG.documents.find((d) => d.key === key)?.required
  it('MOPP, conta Itaú, certidão civil, certidão dos filhos e reservista são obrigatórios quando a condição vale', () => {
    for (const key of ['MOPP', 'CONTA_ITAU', 'CERTIDAO_CIV', 'CERT_FILHOS', 'RESERVISTA']) assert.equal(required(key), true, key)
  })
  it('empilhadeira, vacinação, matrícula e documento do cônjuge continuam opcionais', () => {
    for (const key of ['EMPILHADEIRA', 'VACINACAO', 'MATRICULA', 'RG_CNH_CONJUGE']) assert.equal(required(key), false, key)
  })
})

describe('reservista: homem de 18 a 45 anos', () => {
  const now = new Date(2026, 10, 13)
  it('homem de 30 anos: sim', () => {
    assert.equal(matchesCondition({ type: 'militaryAge' }, { gender: 'Masculino', birthDate: '1996-05-01' }, now), true)
  })
  it('homem de 17 ou de 46 anos: não', () => {
    assert.equal(matchesCondition({ type: 'militaryAge' }, { gender: 'Masculino', birthDate: '2009-01-01' }, now), false)
    assert.equal(matchesCondition({ type: 'militaryAge' }, { gender: 'Masculino', birthDate: '1980-01-01' }, now), false)
  })
  it('mulher: não; sem data de nascimento: segue o gênero (pede)', () => {
    assert.equal(matchesCondition({ type: 'militaryAge' }, { gender: 'Feminino', birthDate: '1996-05-01' }, now), false)
    assert.equal(matchesCondition({ type: 'militaryAge' }, { gender: 'Masculino' }, now), true)
  })
  it('a configuração padrão continua passando pela validação do editor', () => {
    assert.equal(FormConfigSchema.safeParse(DEFAULT_FORM_CONFIG).success, true)
  })
})
