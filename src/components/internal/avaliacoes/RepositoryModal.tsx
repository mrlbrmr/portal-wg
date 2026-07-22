"use client"

import { useState } from 'react'
import { X, FlaskConical, BookOpen, Brain, Clock, Loader2 } from 'lucide-react'
import { REPOSITORY_TEMPLATES, type TemplateRepositoryItem } from '@/lib/avaliacoes/repository'
import { KIND_LABELS, KIND_COLORS, type TemplateKind } from '@/lib/avaliacoes/schema'
import { cn } from '@/lib/utils'

interface Props {
  onClose: () => void
  onImported: (newId: string) => void
}

const ICONS: Record<TemplateKind, typeof FlaskConical> = {
  SCREENING: FlaskConical,
  TECHNICAL: BookOpen,
  PERSONALITY_BIG5: Brain,
}

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

export function RepositoryModal({ onClose, onImported }: Props) {
  const [importing, setImporting] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  async function importTemplate(tmpl: TemplateRepositoryItem) {
    setImporting(tmpl.key)
    setError(null)
    try {
      const res = await fetch('/api/assessment-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tmpl.name,
          kind: tmpl.kind,
          subtype: tmpl.subtype,
          description: tmpl.description,
          estimatedMin: tmpl.estimatedMin,
          instructions: tmpl.instructions,
          passingScore: tmpl.passingScore,
          questions: tmpl.questions,
        }),
      })
      const body = await res.json() as { id?: string; error?: unknown }
      if (!res.ok || !body.id) { setError('Erro ao importar. Tente novamente.'); return }
      onImported(body.id)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setImporting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Repositório de testes</h2>
            <p className="text-xs text-gray-400 mt-0.5">Selecione um template — as questões serão copiadas e você poderá editar antes de salvar.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {REPOSITORY_TEMPLATES.map((tmpl) => {
              const kind   = tmpl.kind as TemplateKind
              const Icon   = ICONS[kind]
              const color  = COLOR_CLASSES[KIND_COLORS[kind] ?? 'blue']
              const isLoading = importing === tmpl.key
              return (
                <div key={tmpl.key} className={cn('border rounded-2xl p-5 flex flex-col gap-3', color.border)}>
                  <div className="flex items-start gap-3">
                    <div className={cn('w-9 h-9 rounded-xl grid place-items-center shrink-0', color.bg)}>
                      <Icon className={cn('w-4.5 h-4.5', color.text)} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm leading-snug">{tmpl.name}</p>
                      <span className={cn('inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium', color.bg, color.text)}>
                        {KIND_LABELS[kind]}{tmpl.subtype ? ` · ${tmpl.subtype}` : ''}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{tmpl.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{tmpl.questions.length} questões</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {tmpl.estimatedMin} min</span>
                    {tmpl.passingScore != null && <span>Mín. {tmpl.passingScore}%</span>}
                  </div>
                  <button
                    onClick={() => importTemplate(tmpl)}
                    disabled={!!importing}
                    className={cn(
                      'mt-auto inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60',
                      color.bg, color.text, 'hover:opacity-80',
                    )}
                  >
                    {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando...</> : 'Importar'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 text-right">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2">Fechar</button>
        </div>
      </div>
    </div>
  )
}
