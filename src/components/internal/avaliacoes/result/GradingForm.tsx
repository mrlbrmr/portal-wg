"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/ToastProvider'

export interface GradingItem {
  id: string
  index: number
  text: string
  weight: number
  given: string | null
  points: number | null
}

/**
 * Correção das questões dissertativas de um teste técnico. O RH atribui de 0 ao peso de
 * cada questão; ao salvar, o servidor recalcula a nota final e a situação no critério.
 */
export function GradingForm({ sessionId, items, canManage }: { sessionId: string; items: GradingItem[]; canManage: boolean }) {
  const router = useRouter()
  const { notify } = useToast()
  const [points, setPoints] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.points === null ? '' : String(i.points)]))
  )
  const [saving, setSaving] = useState(false)

  const missing = items.filter((i) => points[i.id] === '' || points[i.id] === undefined).length
  const invalid = items.some((i) => {
    const v = Number(points[i.id])
    return points[i.id] !== '' && (Number.isNaN(v) || v < 0 || v > i.weight)
  })

  const save = async () => {
    setSaving(true)
    try {
      const grades = Object.fromEntries(items.map((i) => [i.id, Number(points[i.id])]))
      const res = await fetch(`/api/assessment-sessions/${sessionId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; score?: number }
      if (!res.ok) throw new Error(data.error)
      notify('success', `Correção salva. Nota final: ${data.score ?? '—'}%.`)
      router.refresh()
    } catch (e) {
      notify('error', (e as Error).message || 'Não foi possível salvar a correção.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <ol className="space-y-5">
        {items.map((i) => (
          <li key={i.id}>
            <p className="text-body font-medium text-wg-ink">
              <span className="mr-1.5 tabular-nums text-wg-ink-muted">{i.index}.</span>
              {i.text}
            </p>
            <blockquote className="mt-2 whitespace-pre-wrap rounded-control bg-wg-bg px-3 py-2.5 text-body text-wg-ink-secondary">
              {i.given?.trim() ? i.given : <span className="italic text-wg-ink-muted">Sem resposta.</span>}
            </blockquote>
            <label className="mt-2 flex items-center gap-2 text-meta text-wg-ink-muted">
              Pontos
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={i.weight}
                step={0.5}
                value={points[i.id] ?? ''}
                disabled={!canManage || saving}
                onChange={(e) => setPoints((p) => ({ ...p, [i.id]: e.target.value }))}
                className="h-8 w-20 rounded-control border border-wg-border-light bg-white px-2 text-body tabular-nums text-wg-ink outline-none focus:border-wg-green focus:ring-2 focus:ring-wg-green/30 disabled:bg-wg-bg"
                aria-label={`Pontos da questão ${i.index} (de 0 a ${i.weight})`}
              />
              de {i.weight}
            </label>
          </li>
        ))}
      </ol>

      {canManage && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={Check} loading={saving} disabled={missing > 0 || invalid} onClick={save}>
            Salvar correção
          </Button>
          <span className="text-meta text-wg-ink-muted">
            {invalid
              ? 'Os pontos devem ficar entre 0 e o peso da questão.'
              : missing > 0
                ? `Falta pontuar ${missing} ${missing === 1 ? 'questão' : 'questões'}.`
                : 'A nota final é recalculada com as objetivas + os pontos informados.'}
          </span>
        </div>
      )}
    </div>
  )
}
