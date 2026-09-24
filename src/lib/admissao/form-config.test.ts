// Retomada do formulário digital: arquivos já enviados voltam ao documento certo.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { restoreFormUploads } from './form-config'

const config = {
  documents: [
    { key: 'RG_CNH', label: 'RG/CNH - Frente e verso', required: true, condition: { type: 'always' as const } },
    { key: 'TITULO', label: 'Título de Eleitor', required: true, condition: { type: 'always' as const } },
  ],
}
const types = [
  { id: 't-rg', name: 'RG/CNH - Frente e verso' },
  { id: 't-tit', name: 'Título de Eleitor' },
  { id: 't-aso', name: 'ASO' },
]

describe('restoreFormUploads', () => {
  it('agrupa os arquivos pelo documento do formulário', () => {
    const out = restoreFormUploads(config, types, [
      { id: 'a1', fileName: 'frente.jpg', documentTypeId: 't-rg' },
      { id: 'a2', fileName: 'verso.jpg', documentTypeId: 't-rg' },
      { id: 'a3', fileName: 'titulo.jpg', documentTypeId: 't-tit' },
    ])
    assert.deepEqual(out, {
      RG_CNH: [
        { attachmentId: 'a1', fileName: 'frente.jpg' },
        { attachmentId: 'a2', fileName: 'verso.jpg' },
      ],
      TITULO: [{ attachmentId: 'a3', fileName: 'titulo.jpg' }],
    })
  })

  it('ignora recusados pelo RH, sem tipo e tipos fora do formulário', () => {
    const out = restoreFormUploads(config, types, [
      { id: 'a1', fileName: 'rg.jpg', documentTypeId: 't-rg', reviewStatus: 'rejected' },
      { id: 'a2', fileName: 'x.pdf', documentTypeId: null },
      { id: 'a3', fileName: 'aso.pdf', documentTypeId: 't-aso' },
      { id: 'a4', fileName: 'rg2.jpg', documentTypeId: 't-rg', reviewStatus: 'approved' },
    ])
    assert.deepEqual(out, { RG_CNH: [{ attachmentId: 'a4', fileName: 'rg2.jpg' }] })
  })
})
