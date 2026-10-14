// Vínculo admissão ↔ candidatura: sugestões, bloqueio, unificação, etapa e posição.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  accentInsensitivePattern,
  blankFieldsFromCandidate,
  linkBlocker,
  matchReasons,
  normalizePhone,
  positionPlan,
  rankCandidates,
  sanitizeSearch,
  suggestedHiringStage,
  type LinkStage,
  type PersonKeys,
} from './candidate-link'

const adm: PersonKeys = { fullName: 'João da Silva Souza', cpf: '123.456.789-09', email: 'Joao@Mail.com', phone: '(41) 99999-0000' }

describe('matchReasons', () => {
  it('reconhece CPF, e-mail e telefone apesar da formatação', () => {
    const r = matchReasons(adm, { fullName: 'Outro Nome', cpf: '12345678909', email: ' joao@mail.com ', phone: '+55 41 99999 0000' })
    assert.deepEqual(r, ['CPF', 'EMAIL', 'PHONE'])
  })

  it('nome igual sem acento/caixa conta como mesmo nome', () => {
    assert.deepEqual(matchReasons(adm, { fullName: 'JOAO DA SILVA SOUZA', cpf: null, email: null, phone: null }), ['NAME'])
  })

  it('primeiro + último nome iguais contam como nome parecido', () => {
    assert.deepEqual(matchReasons(adm, { fullName: 'João Souza', cpf: null, email: null, phone: null }), ['NAME_PARTIAL'])
  })

  it('dados vazios ou incompletos não casam', () => {
    const empty: PersonKeys = { fullName: 'Maria', cpf: '123', email: 'sem-arroba', phone: '9999' }
    assert.deepEqual(matchReasons(empty, empty), [])
  })
})

describe('normalizePhone', () => {
  it('remove o DDI 55 e exige DDD + número', () => {
    assert.equal(normalizePhone('+55 (41) 98888-7777'), '41988887777')
    assert.equal(normalizePhone('98888-7777'), null)
  })
})

describe('rankCandidates', () => {
  it('CPF primeiro; empate → não reprovado e mais recente', () => {
    const base = { cpf: null, email: null, phone: null }
    const list = [
      { id: 'nome-antigo', fullName: 'João da Silva Souza', ...base, createdAt: '2026-01-01', stageKind: 'OPEN' },
      { id: 'nome-reprovado', fullName: 'João da Silva Souza', ...base, createdAt: '2026-09-01', stageKind: 'LOST' },
      { id: 'cpf', fullName: 'J. Souza', ...base, cpf: '12345678909', createdAt: '2025-01-01', stageKind: 'OPEN' },
      { id: 'busca', fullName: 'Pedro', ...base, createdAt: '2026-10-01', stageKind: 'OPEN' },
    ]
    assert.deepEqual(rankCandidates(adm, list).map((c) => c.id), ['cpf', 'nome-antigo', 'nome-reprovado', 'busca'])
  })
})

describe('linkBlocker', () => {
  it('bloqueia candidatura já ligada a outra admissão', () => {
    assert.equal(linkBlocker('a1', null), null)
    assert.equal(linkBlocker('a1', { id: 'a1', fullName: 'João' }), null)
    assert.match(linkBlocker('a1', { id: 'a2', fullName: 'Maria' }) ?? '', /Maria/)
  })
})

describe('blankFieldsFromCandidate', () => {
  it('só completa o que está vazio; nunca sobrescreve', () => {
    const out = blankFieldsFromCandidate(
      { cpf: '', email: 'rh@digitou.com', phone: null },
      { cpf: '123.456.789-09', email: 'outro@mail.com', phone: '41 99999-0000' }
    )
    assert.deepEqual(out, { cpf: '123.456.789-09', phone: '41 99999-0000' })
  })

  it('não copia CPF incompleto nem e-mail inválido', () => {
    assert.deepEqual(blankFieldsFromCandidate({ cpf: null, email: null, phone: 'x' }, { cpf: '123', email: 'nada', phone: null }), {})
  })
})

describe('suggestedHiringStage', () => {
  const stages: LinkStage[] = [
    { id: 'won', name: 'Contratado', kind: 'WON', sortOrder: 80, active: true },
    { id: 'adm', name: 'Admissão', kind: 'ADMISSION', sortOrder: 70, active: true },
    { id: 'old', name: 'Admissão antiga', kind: 'ADMISSION', sortOrder: 10, active: false },
    { id: 'int', name: 'Entrevista', kind: 'OPEN', sortOrder: 50, active: true },
  ]

  it('sugere a etapa de Admissão ativa para quem ainda está no processo', () => {
    assert.equal(suggestedHiringStage('OPEN', stages), 'adm')
    assert.equal(suggestedHiringStage('LOST', stages), 'adm')
  })

  it('não mexe em quem já está em Admissão/Contratado', () => {
    assert.equal(suggestedHiringStage('ADMISSION', stages), null)
    assert.equal(suggestedHiringStage('WON', stages), null)
  })

  it('sem etapa de Admissão, usa Contratado; sem nenhuma, null', () => {
    assert.equal(suggestedHiringStage('OPEN', stages.filter((s) => s.kind !== 'ADMISSION')), 'won')
    assert.equal(suggestedHiringStage('OPEN', []), null)
  })
})

describe('positionPlan', () => {
  const pos = (id: string, n: number, status: string, applicationId: string | null = null, admissionId: string | null = null) => ({
    id, positionNumber: n, status, applicationId, admissionId,
  })

  it('candidatura que já ocupa posição liga a admissão a ela', () => {
    const plan = positionPlan('app', 'adm', [pos('p1', 1, 'OPEN'), pos('p2', 2, 'FILLED', 'app', null)])
    assert.deepEqual(plan, { kind: 'occupied', positionId: 'p2', positionNumber: 2, hasOtherAdmission: false })
  })

  it('avisa quando a posição ocupada já aponta outra admissão', () => {
    const plan = positionPlan('app', 'adm', [pos('p2', 2, 'FILLED', 'app', 'outra')])
    assert.equal(plan.kind === 'occupied' && plan.hasOtherAdmission, true)
  })

  it('lista as posições em aberto em ordem; sem nenhuma → none', () => {
    assert.deepEqual(positionPlan('app', 'adm', [pos('p3', 3, 'OPEN'), pos('p1', 1, 'OPEN'), pos('p2', 2, 'CANCELLED')]), {
      kind: 'open',
      options: [{ id: 'p1', positionNumber: 1 }, { id: 'p3', positionNumber: 3 }],
    })
    assert.deepEqual(positionPlan('app', 'adm', [pos('p1', 1, 'FILLED', 'outro')]), { kind: 'none' })
  })
})

describe('sanitizeSearch', () => {
  it('remove o que quebra o filtro or() e mantém e-mail', () => {
    assert.equal(sanitizeSearch(' joao.silva@mail.com '), 'joao.silva@mail.com')
    assert.equal(sanitizeSearch('a,b(c)*%'), 'a b c')
  })
})

describe("accentInsensitivePattern", () => {
  it("troca vogais e c por curinga de um caractere", () => {
    assert.equal(accentInsensitivePattern("Antônio"), "_nt_n__")
    assert.equal(accentInsensitivePattern("Conceição"), "__n______")
    assert.equal(accentInsensitivePattern("conceicao"), accentInsensitivePattern("Conceição"))
  })
})
