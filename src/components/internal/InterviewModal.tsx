"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/ToastProvider"

interface Props {
  applicationId: string
  candidateName: string
  onClose: () => void
  onSuccess: () => void
}

const OUTCOMES = [
  { value: "RECOMMEND", label: "Positivo", active: "border-emerald-400 bg-emerald-50 text-emerald-700", idle: "border-gray-200 text-gray-500" },
  { value: "PENDING",   label: "Neutro",   active: "border-amber-400 bg-amber-50 text-amber-700",     idle: "border-gray-200 text-gray-500" },
  { value: "REJECT",    label: "Negativo", active: "border-red-400 bg-red-50 text-red-700",           idle: "border-gray-200 text-gray-500" },
] as const

type OutcomeVal = (typeof OUTCOMES)[number]["value"]

export function InterviewModal({ applicationId, candidateName, onClose, onSuccess }: Props) {
  const { notify } = useToast()
  const [notes, setNotes]             = useState("")
  const [scoreEnabled, setScoreEnabled] = useState(false)
  const [score, setScore]             = useState(70)
  const [outcome, setOutcome]         = useState<OutcomeVal>("PENDING")
  const [occurredAt, setOccurredAt]   = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving]           = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = new FormData()
      body.append("kind", "INTERVIEW")
      body.append("title", "Entrevista")
      body.append("outcome", outcome)
      body.append("occurredAt", new Date(occurredAt).toISOString())
      if (notes.trim()) body.append("summary", notes.trim())
      if (scoreEnabled) body.append("score", String(score))

      const res = await fetch(`/api/applications/${applicationId}/assessments`, {
        method: "POST",
        body,
        credentials: "same-origin",
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? "Erro ao salvar")
      }
      notify("success", "Entrevista registrada com sucesso.")
      onSuccess()
      onClose()
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Erro ao registrar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Registrar entrevista</h2>
            <p className="text-xs text-gray-500 mt-0.5">{candidateName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Data */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Data da entrevista</label>
            <input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>

          {/* Parecer */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Parecer do recrutador</label>
            <div className="flex gap-2">
              {OUTCOMES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOutcome(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    outcome === opt.value ? opt.active : opt.idle + " hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nota */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700">
                Nota <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              {scoreEnabled ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-600">{score}/100</span>
                  <button
                    type="button"
                    onClick={() => setScoreEnabled(false)}
                    className="text-[10px] text-gray-400 hover:text-red-500"
                  >
                    remover
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setScoreEnabled(true)}
                  className="text-[11px] text-blue-600 hover:underline font-medium"
                >
                  + adicionar nota
                </button>
              )}
            </div>
            {scoreEnabled && (
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            )}
          </div>

          {/* Anotações */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Anotações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Percepções, pontos fortes, dúvidas, próximos passos…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 placeholder:text-gray-400"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Salvando…" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
