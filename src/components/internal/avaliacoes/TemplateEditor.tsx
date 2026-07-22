"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Sparkles, Database, Eye, EyeOff } from 'lucide-react'
import { KIND_LABELS, type TemplateKind, type Question } from '@/lib/avaliacoes/schema'
import { QuestionEditor } from './QuestionEditor'
import { AIGenerateModal } from './AIGenerateModal'
import { RepositoryModal } from './RepositoryModal'

interface TemplateData {
  id: string
  name: string
  description: string | null
  kind: string
  subtype: string | null
  estimatedMin: number | null
  instructions: string | null
  passingScore: number | null
  isActive: boolean
  questions: Question[]
}

interface Props {
  mode: 'create' | 'edit'
  template?: TemplateData
  canManage?: boolean
}

type ActiveTab = 'manual' | 'ai' | 'repository'

const KINDS: TemplateKind[] = ['SCREENING', 'TECHNICAL', 'PERSONALITY_BIG5']
const SUBTYPES: Record<string, string[]> = {
  TECHNICAL: ['PORTUGUESE', 'EXCEL', 'CUSTOM'],
}

export function TemplateEditor({ mode, template, canManage = true }: Props) {
  const router = useRouter()

  const [name, setName]               = useState(template?.name ?? '')
  const [kind, setKind]               = useState<TemplateKind>((template?.kind as TemplateKind) ?? 'SCREENING')
  const [subtype, setSubtype]         = useState(template?.subtype ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [estimatedMin, setEstimatedMin] = useState<number | ''>(template?.estimatedMin ?? '')
  const [passingScore, setPassingScore] = useState<number | ''>(template?.passingScore ?? '')
  const [instructions, setInstructions] = useState(template?.instructions ?? '')
  const [questions, setQuestions]     = useState<Question[]>(template?.questions ?? [])
  const [tab, setTab]                 = useState<ActiveTab>('manual')
  const [showAI, setShowAI]           = useState(false)
  const [showRepo, setShowRepo]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  const readonly = !canManage

  async function save() {
    if (!name.trim()) { setError('O nome é obrigatório.'); return }
    setSaving(true)
    setError(null)
    try {
      const body = {
        name: name.trim(),
        kind,
        subtype: subtype || null,
        description: description || null,
        estimatedMin: estimatedMin !== '' ? estimatedMin : null,
        passingScore: passingScore !== '' ? passingScore : null,
        instructions: instructions || null,
        questions,
      }
      const url    = mode === 'create' ? '/api/assessment-templates' : `/api/assessment-templates/${template!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json() as { id?: string; error?: unknown }
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Erro ao salvar.'); return }
      router.push(mode === 'create' ? `/avaliacoes/banco/${data.id}` : '/avaliacoes/banco')
      router.refresh()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function handleRepoImport(importedId: string) {
    router.push(`/avaliacoes/banco/${importedId}`)
    setShowRepo(false)
  }

  return (
    <div className="max-w-4xl">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/avaliacoes/banco" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-4 h-4" /> Banco de Testes
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-700 font-medium">{mode === 'create' ? 'Novo teste' : (template?.name ?? '')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode((p) => !p)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg"
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewMode ? 'Editar' : 'Pré-visualizar'}
          </button>
          {canManage && (
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-60 px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><Save className="w-4 h-4" /> Salvar</>}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metadados */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Metadados</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome <span className="text-red-500">*</span></label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={readonly}
                placeholder="Ex: Teste de Excel Intermediário"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wg-green/30 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo <span className="text-red-500">*</span></label>
              <select
                value={kind}
                onChange={(e) => { setKind(e.target.value as TemplateKind); setSubtype('') }}
                disabled={readonly}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wg-green/30 disabled:bg-gray-50"
              >
                {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select>
            </div>

            {SUBTYPES[kind] && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subtipo</label>
                <select
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                  disabled={readonly}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wg-green/30 disabled:bg-gray-50"
                >
                  <option value="">— Selecione —</option>
                  {SUBTYPES[kind].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readonly}
                rows={3}
                placeholder="Descrição para o RH..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wg-green/30 resize-none disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Tempo estimado (min)</label>
                <input
                  type="number" min={1}
                  value={estimatedMin}
                  onChange={(e) => setEstimatedMin(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={readonly}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wg-green/30 disabled:bg-gray-50"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Nota mínima (%)</label>
                <input
                  type="number" min={0} max={100}
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={readonly}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wg-green/30 disabled:bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Instruções ao candidato</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={readonly}
                rows={4}
                placeholder="Estas instruções serão exibidas ao candidato antes de iniciar o teste..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wg-green/30 resize-none disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 leading-relaxed">
            <strong className="font-semibold">Total:</strong> {questions.length} questões · peso total: {questions.reduce((s, q) => s + (q.weight ?? 1), 0)}
          </div>
        </div>

        {/* Questões */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            {/* Abas de criação */}
            {!readonly && !previewMode && (
              <div className="flex gap-1 mb-5 border-b border-gray-100 pb-4">
                {[
                  { key: 'manual', label: 'Manual' },
                  { key: 'ai',    label: <><Sparkles className="inline w-3 h-3 mr-1" />Gerar via IA</> },
                  { key: 'repository', label: <><Database className="inline w-3 h-3 mr-1" />Repositório</> },
                ] .map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (key === 'ai') { setShowAI(true); return }
                      if (key === 'repository') { setShowRepo(true); return }
                      setTab(key as ActiveTab)
                    }}
                    className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === key && key === 'manual' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Questões <span className="text-gray-400 font-normal">({questions.length})</span>
              </h2>
            </div>

            <QuestionEditor
              questions={questions}
              onChange={readonly ? () => {} : setQuestions}
              showBigFive={kind === 'PERSONALITY_BIG5'}
            />
          </div>
        </div>
      </div>

      {showAI && (
        <AIGenerateModal
          kind={kind}
          subtype={subtype || null}
          onAdd={(newQs) => setQuestions((prev) => [...prev, ...newQs])}
          onClose={() => setShowAI(false)}
        />
      )}

      {showRepo && (
        <RepositoryModal
          onClose={() => setShowRepo(false)}
          onImported={handleRepoImport}
        />
      )}
    </div>
  )
}
