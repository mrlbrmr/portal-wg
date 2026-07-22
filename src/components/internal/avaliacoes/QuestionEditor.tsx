"use client"

import { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import { QUESTION_TYPE_LABELS, LIKERT_OPTIONS, BIG5_LABELS, type QuestionType, type BigFiveDimension } from '@/lib/avaliacoes/schema'
import type { Question } from '@/lib/avaliacoes/schema'

interface Props {
  questions: Question[]
  onChange: (questions: Question[]) => void
  showBigFive?: boolean
}

const TYPES: QuestionType[] = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_TEXT', 'SCALE_LIKERT']

function newQuestion(type: QuestionType): Question {
  const base = { id: crypto.randomUUID(), type, text: '', weight: 1 }
  if (type === 'MULTIPLE_CHOICE') return { ...base, options: ['', '', '', ''], correctAnswer: '' }
  if (type === 'TRUE_FALSE') return { ...base, options: ['Verdadeiro', 'Falso'], correctAnswer: 'Verdadeiro' }
  if (type === 'SCALE_LIKERT') return { ...base, isReversed: false }
  return base
}

export function QuestionEditor({ questions, onChange, showBigFive = false }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function update(id: string, patch: Partial<Question>) {
    onChange(questions.map((q) => q.id === id ? { ...q, ...patch } : q))
  }

  function remove(id: string) {
    onChange(questions.filter((q) => q.id !== id))
  }

  function add(type: QuestionType) {
    onChange([...questions, newQuestion(type)])
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...questions]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    onChange(next)
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
          Nenhuma questão adicionada. Clique em &ldquo;Adicionar questão&rdquo; abaixo.
        </div>
      ) : (
        questions.map((q, idx) => (
          <div key={q.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
              <span className="text-xs font-semibold text-gray-500 mr-auto">Q{idx + 1} · {QUESTION_TYPE_LABELS[q.type]}</span>
              <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => move(idx, 1)} disabled={idx === questions.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => toggleCollapse(q.id)}
                className="p-1 text-gray-400 hover:text-gray-600">
                {collapsed[q.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => remove(q.id)}
                className="p-1 text-red-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {!collapsed[q.id] && (
              <div className="p-4 space-y-3">
                <textarea
                  value={q.text}
                  onChange={(e) => update(q.id, { text: e.target.value })}
                  placeholder="Texto da questão..."
                  rows={2}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wg-green/30 resize-none"
                />

                {/* Múltipla escolha */}
                {q.type === 'MULTIPLE_CHOICE' && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500">Alternativas</p>
                    {(q.options ?? ['', '', '', '']).map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correctAnswer === opt && opt !== ''}
                          onChange={() => update(q.id, { correctAnswer: opt })}
                          className="shrink-0"
                        />
                        <input
                          value={opt}
                          onChange={(e) => {
                            const opts = [...(q.options ?? [])]
                            opts[oi] = e.target.value
                            const patch: Partial<Question> = { options: opts }
                            if (q.correctAnswer === opt) patch.correctAnswer = e.target.value
                            update(q.id, patch)
                          }}
                          placeholder={`Alternativa ${String.fromCharCode(65 + oi)}`}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-wg-green/20"
                        />
                      </div>
                    ))}
                    <p className="text-xs text-gray-400">Selecione o rádio ao lado da alternativa correta</p>
                  </div>
                )}

                {/* Verdadeiro/Falso */}
                {q.type === 'TRUE_FALSE' && (
                  <div className="flex gap-4">
                    {['Verdadeiro', 'Falso'].map((v) => (
                      <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`tf-${q.id}`}
                          checked={q.correctAnswer === v}
                          onChange={() => update(q.id, { correctAnswer: v })}
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                )}

                {/* Likert preview */}
                {q.type === 'SCALE_LIKERT' && (
                  <div className="flex gap-2 flex-wrap">
                    {LIKERT_OPTIONS.map((opt) => (
                      <span key={opt} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{opt}</span>
                    ))}
                  </div>
                )}

                {/* Campos extras: Big Five */}
                {showBigFive && q.type === 'SCALE_LIKERT' && (
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500">Dimensão Big Five</label>
                      <select
                        value={q.bigFiveDimension ?? ''}
                        onChange={(e) => update(q.id, { bigFiveDimension: (e.target.value as BigFiveDimension) || undefined })}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-wg-green/20"
                      >
                        <option value="">—</option>
                        {(Object.entries(BIG5_LABELS) as [BigFiveDimension, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-600 mt-auto mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.isReversed ?? false}
                        onChange={(e) => update(q.id, { isReversed: e.target.checked })}
                        className="rounded"
                      />
                      Item reverso
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-500">Peso</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={q.weight}
                    onChange={(e) => update(q.id, { weight: Number(e.target.value) })}
                    className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-wg-green/20"
                  />
                </div>
              </div>
            )}
          </div>
        ))
      )}

      {/* Adicionar questão */}
      <div className="flex gap-2 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => add(t)}
            className="inline-flex items-center gap-1.5 text-xs font-medium border border-dashed border-gray-300 text-gray-500 hover:border-wg-green hover:text-wg-green-dark px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {QUESTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  )
}
