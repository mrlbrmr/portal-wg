"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Database, Search, FlaskConical, BookOpen, Brain, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { KIND_LABELS, KIND_COLORS, type TemplateKind } from '@/lib/avaliacoes/schema'
import { RepositoryModal } from './RepositoryModal'
import { cn } from '@/lib/utils'

interface TemplateRow {
  id: string
  name: string
  description: string | null
  kind: string
  subtype: string | null
  estimatedMin: number | null
  passingScore: number | null
  isActive: boolean
  createdAt: string
  questions: unknown[]
}

interface Props {
  templates: TemplateRow[]
  canManage: boolean
}

const KIND_ICONS: Record<TemplateKind, typeof FlaskConical> = {
  SCREENING: FlaskConical,
  TECHNICAL: BookOpen,
  PERSONALITY_BIG5: Brain,
}

const COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700' },
}

export function TemplateBancoList({ templates: initial, canManage }: Props) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initial)
  const [search, setSearch]       = useState('')
  const [kindFilter, setKindFilter] = useState<string>('ALL')
  const [showInactive, setShowInactive] = useState(false)
  const [showRepo, setShowRepo]   = useState(false)
  const [toggling, setToggling]   = useState<string | null>(null)

  const filtered = templates.filter((t) => {
    if (!showInactive && !t.isActive) return false
    if (kindFilter !== 'ALL' && t.kind !== kindFilter) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function toggleActive(id: string, current: boolean) {
    setToggling(id)
    try {
      const res = await fetch(`/api/assessment-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      })
      if (res.ok) {
        setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, isActive: !current } : t))
      }
    } finally {
      setToggling(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Banco de Testes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Templates de avaliação reutilizáveis entre vagas</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowRepo(true)}
              className="inline-flex items-center gap-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
            >
              <Database className="w-4 h-4" /> Importar do repositório
            </button>
            <Link
              href="/avaliacoes/banco/novo"
              className="inline-flex items-center gap-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Novo teste
            </Link>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar teste..."
            className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wg-green/30 w-52"
          />
        </div>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wg-green/30"
        >
          <option value="ALL">Todos os tipos</option>
          <option value="SCREENING">Triagem</option>
          <option value="TECHNICAL">Técnico</option>
          <option value="PERSONALITY_BIG5">Personalidade (Big Five)</option>
        </select>
        {canManage && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Mostrar inativos
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <FlaskConical className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum teste encontrado</p>
          <p className="text-sm text-gray-400 mt-1">
            {templates.length === 0
              ? 'Crie seu primeiro teste ou importe do repositório.'
              : 'Ajuste os filtros para ver outros resultados.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Questões</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Tempo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Mín. %</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((t) => {
                const kind  = t.kind as TemplateKind
                const Icon  = KIND_ICONS[kind] ?? FlaskConical
                const color = COLOR_CLASSES[KIND_COLORS[kind] ?? 'blue']
                return (
                  <tr key={t.id} className={cn('hover:bg-gray-50 transition-colors', !t.isActive && 'opacity-50')}>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{t.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', color.bg, color.text)}>
                        <Icon className="w-3 h-3" />
                        {KIND_LABELS[kind]}
                        {t.subtype && <span className="opacity-70">· {t.subtype}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-gray-600">
                      {Array.isArray(t.questions) ? t.questions.length : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {t.estimatedMin ? (
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <Clock className="w-3.5 h-3.5" /> {t.estimatedMin} min
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center text-gray-600">
                      {t.passingScore != null ? `${t.passingScore}%` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {t.isActive
                        ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" /> Ativo</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5"><XCircle className="w-3 h-3" /> Inativo</span>
                      }
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/avaliacoes/banco/${t.id}`}
                          className="text-xs text-wg-green-dark font-medium hover:underline"
                        >
                          {canManage ? 'Editar' : 'Ver'}
                        </Link>
                        {canManage && (
                          <button
                            onClick={() => toggleActive(t.id, t.isActive)}
                            disabled={toggling === t.id}
                            className="text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
                          >
                            {toggling === t.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : t.isActive ? 'Desativar' : 'Ativar'
                            }
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showRepo && (
        <RepositoryModal
          onClose={() => setShowRepo(false)}
          onImported={(id) => {
            router.push(`/avaliacoes/banco/${id}`)
            setShowRepo(false)
          }}
        />
      )}
    </div>
  )
}
