// Validação por IA: falha técnica ≠ problema no documento.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fileStatus, needsAttention, DOCUMENT_STATUS_META } from './document-status'
import { isTransientGeminiError, AI_RETRY_DELAYS_MS } from '../ai/gemini'

describe('status do documento quando a IA não conseguiu verificar', () => {
  it('vira "Não verificado pela IA" e não pede ação do RH', () => {
    const s = fileStatus({ aiStatus: 'unavailable' })
    assert.equal(s, 'AI_UNAVAILABLE')
    assert.equal(DOCUMENT_STATUS_META[s].label, 'Não verificado pela IA')
    assert.equal(needsAttention(s), false)
  })
  it('problema encontrado pela IA continua pedindo revisão', () => {
    assert.equal(needsAttention(fileStatus({ aiStatus: 'needs_review' })), true)
  })
  it('a decisão do RH prevalece', () => {
    assert.equal(fileStatus({ aiStatus: 'unavailable', reviewStatus: 'approved' }), 'HR_APPROVED')
  })
})

describe('erro transitório do Gemini (vale tentar de novo)', () => {
  it('sobrecarga e limite: sim', () => {
    assert.equal(isTransientGeminiError({ status: 503, message: 'overloaded' }), true)
    assert.equal(isTransientGeminiError({ status: 500 }), true)
    assert.equal(isTransientGeminiError({ status: 429 }), true)
  })
  it('falha de rede sem status: sim', () => {
    assert.equal(isTransientGeminiError(new Error('fetch failed')), true)
    assert.equal(isTransientGeminiError(new Error('The operation was aborted due to timeout')), true)
  })
  it('chave inválida, sem permissão ou sem chave: não', () => {
    assert.equal(isTransientGeminiError({ status: 400, message: 'API key not valid' }), false)
    assert.equal(isTransientGeminiError({ status: 403 }), false)
    assert.equal(isTransientGeminiError(new Error('GEMINI_API_KEY não configurado')), false)
  })
  it('tenta até 3 vezes com espera crescente', () => {
    assert.deepEqual(AI_RETRY_DELAYS_MS, [0, 3000, 8000])
  })
})
