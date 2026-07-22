"use client"

import { useState } from 'react'
import { X, Sparkles, Loader2, Check } from 'lucide-react'
import type { Question, TemplateKind } from '@/lib/avaliacoes/schema'

interface Props {
  kind: TemplateKind
  subtype?: string | null
  onAdd: (questions: Question[]) => void
  onClose: () => void
}

export function AIGenerateModal({ kind, subtype, onAdd, onClose }: Props) {
  const [jobTitle, setJobTitle]       = useState('')
  const [jobDesc, setJobDesc]         = useState('')
  const [count, setCount]             = useState(10)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [generated, setGenerated]     = useState<Question[] | null>(null)
  const [selected, setSelected]       = useState<Record<number, boolean>>({})

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/assessment-templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, jobDescription: jobDesc, kind, subtype, count }),
      })
      const body = await res.json() as { questions?: Question[]; error?: unknown }
      if (!res.ok) { setError('Erro ao gerar questões. Tente novamente.'); return }
      const qs = body.questions ?? []
      setGenerated(qs)
      setSelected(Object.fromEntries(qs.map((_, i) => [i, true])))
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function confirm() {
    if (!generated) return
    const chosen = generated.filter((_, i) => selected[i])
    onAdd(chosen)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h2 className="font-semibold text-gray-900">Gerar questões via IA</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {!generated ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título do cargo <span className="text-red-500">*</span></label>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ex: Auxiliar de Logística"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wg-green/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição da vaga (opcional)</label>
                <textarea
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  placeholder="Descreva as principais responsabilidades e requisitos..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wg-green/30 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de questões</label>
                <input
                  type="number"
                  min={5}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wg-green/30"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {generated.length} questões geradas. Selecione as que deseja adicionar ao editor:
              </p>
              {generated.map((q, i) => (
                <label key={q.id} className="flex gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selected[i] ?? true}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [i]: e.target.checked }))}
                    className="mt-1 shrink-0"
                  />
                  <div className="flex-1 border border-gray-200 rounded-xl p-3 group-has-[:checked]:border-wg-green/40 group-has-[:checked]:bg-wg-green/5 transition-colors">
                    <p className="text-sm text-gray-800 mb-2">{i + 1}. {q.text}</p>
                    {q.options && (
                      <div className="grid grid-cols-2 gap-1">
                        {q.options.map((opt) => (
                          <span key={opt} className={`text-xs px-2 py-0.5 rounded ${opt === q.correctAnswer ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-500'}`}>
                            {opt === q.correctAnswer && <Check className="inline w-3 h-3 mr-0.5" />}{opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2">Cancelar</button>
          {!generated ? (
            <button
              onClick={generate}
              disabled={loading || !jobTitle.trim()}
              className="inline-flex items-center gap-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg transition-colors"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : <><Sparkles className="w-4 h-4" /> Gerar</>}
            </button>
          ) : (
            <>
              <button onClick={() => setGenerated(null)} className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2">
                Gerar novamente
              </button>
              <button
                onClick={confirm}
                disabled={Object.values(selected).every((v) => !v)}
                className="inline-flex items-center gap-2 text-sm font-semibold bg-gray-900 hover:bg-gray-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg transition-colors"
              >
                Adicionar ao editor
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
