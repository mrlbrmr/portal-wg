"use client"

import { useCallback, useEffect, useState } from "react"
import { ClipboardList, Copy, Check, Plus, Loader2, X, ExternalLink, ChevronDown, ChevronUp, BarChart3 } from "lucide-react"
import { useToast } from "@/components/ui/ToastProvider"
import { formatDate } from "@/lib/utils"
import { BigFiveRadar, BigFiveBars, BigFiveMini, type BigFiveScores } from "@/components/internal/BigFiveChart"

interface TemplateOption {
  id: string
  name: string
  kind: string
  estimatedMin: number | null
}

interface SessionItem {
  id: string
  token: string
  templateId: string
  template: { name: string; kind: string; estimatedMin: number | null } | null
  expiresAt: string | null
  startedAt: string | null
  submittedAt: string | null
  score: number | null
  outcome: string | null
  scoreBreakdown: Record<string, unknown> | null
  sentBy: string | null
  createdAt: string
}

function bigFiveScores(breakdown: Record<string, unknown> | null | undefined): BigFiveScores | null {
  const bf = (breakdown as { bigFive?: Record<string, number | null> } | null)?.bigFive
  if (!bf) return null
  return { O: bf.O ?? null, C: bf.C ?? null, E: bf.E ?? null, A: bf.A ?? null, N: bf.N ?? null }
}

const OUTCOME_LABELS: Record<string, string> = {
  PASS: "Aprovado",
  FAIL: "Reprovado",
  PENDING_REVIEW: "Aguardando revisão",
}
const OUTCOME_COLORS: Record<string, string> = {
  PASS: "bg-wg-green/15 text-wg-green-dark",
  FAIL: "bg-red-100 text-red-700",
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
}

interface Props {
  applicationId: string
  canManage: boolean
  defaultTemplateId?: string | null
}

export function TestSessionsSection({ applicationId, canManage, defaultTemplateId }: Props) {
  const { notify } = useToast()
  const [sessions, setSessions] = useState<SessionItem[] | null>(null)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [open, setOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplateId ?? "")
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch(`/api/assessment-sessions?applicationId=${applicationId}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { sessions: SessionItem[] }) => setSessions(d.sessions))
      .catch(() => setSessions([]))
  }, [applicationId])

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  useEffect(() => { load() }, [load])

  function openForm() {
    if (templates.length === 0) {
      fetch("/api/assessment-templates", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: TemplateOption[]) => setTemplates(d ?? []))
        .catch(() => setTemplates([]))
    }
    setSelectedTemplateId(defaultTemplateId ?? "")
    setOpen(true)
  }

  async function create() {
    if (!selectedTemplateId) {
      notify("error", "Selecione um template.")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/assessment-sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, templateId: selectedTemplateId }),
      })
      const data = await res.json()
      if (!res.ok) {
        notify("error", data.error ?? "Erro ao criar sessão.")
        return
      }
      notify("success", "Link de avaliação criado. Copie e envie ao candidato.")
      setOpen(false)
      load()
      // Copia o link automaticamente
      navigator.clipboard?.writeText(data.url).catch(() => {})
    } catch {
      notify("error", "Erro de conexão.")
    } finally {
      setCreating(false)
    }
  }

  function copyLink(session: SessionItem) {
    const base = window.location.origin
    const url = `${base}/avaliacao/${session.token}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopiedId(session.id)
    setTimeout(() => setCopiedId((id) => (id === session.id ? null : id)), 2000)
  }

  function sessionStatus(s: SessionItem) {
    if (s.submittedAt) {
      if (s.outcome) {
        // Big Five gera PENDING_REVIEW por design (sem nota de corte), mas o perfil está concluído
        if (s.outcome === "PENDING_REVIEW" && s.template?.kind === "PERSONALITY_BIG5") {
          return { label: "Concluído", color: "bg-blue-100 text-blue-700" }
        }
        return { label: OUTCOME_LABELS[s.outcome] ?? s.outcome, color: OUTCOME_COLORS[s.outcome] ?? "bg-gray-100 text-gray-600" }
      }
      return { label: "Enviado", color: "bg-blue-100 text-blue-700" }
    }
    if (s.startedAt) return { label: "Em andamento", color: "bg-purple-100 text-purple-700" }
    if (s.expiresAt && new Date(s.expiresAt) < new Date()) return { label: "Expirado", color: "bg-gray-100 text-gray-500" }
    return { label: "Pendente", color: "bg-amber-100 text-amber-700" }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-gray-900">Testes Online</h3>
          {sessions && sessions.length > 0 && (
            <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-500">{sessions.length}</span>
          )}
        </div>
        {canManage && !open && (
          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:opacity-80"
          >
            <Plus className="h-3.5 w-3.5" />
            Enviar teste
          </button>
        )}
      </div>

      {/* Formulário de criação */}
      {open && canManage && (
        <div className="mb-3 rounded-lg border border-purple-200 bg-purple-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-800">Novo link de avaliação</span>
            <button type="button" onClick={() => setOpen(false)} className="text-purple-400 hover:text-purple-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="block text-xs text-purple-700 mb-1">Template</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200 mb-3"
          >
            <option value="">— Selecione —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.estimatedMin ? ` (${t.estimatedMin} min)` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={create}
            disabled={creating || !selectedTemplateId}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {creating ? "Criando…" : "Criar link e copiar"}
          </button>
        </div>
      )}

      {/* Lista de sessões */}
      {sessions === null ? (
        <p className="text-sm text-gray-400">Carregando…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum teste enviado ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const status = sessionStatus(s)
            const base = typeof window !== "undefined" ? window.location.origin : "https://carreiras.wgbaterias.com.br"
            const url = `${base}/avaliacao/${s.token}`

            return (
              <li key={s.id} className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 block truncate">
                        {s.template?.name ?? "Template removido"}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                        <span className={`rounded-full px-1.5 py-0.5 font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        {s.score !== null && (
                          <span className="font-semibold text-gray-700">{s.score}/100</span>
                        )}
                        {/* Big Five mini preview inline */}
                        {s.submittedAt && s.template?.kind === "PERSONALITY_BIG5" && (() => {
                          const bf = bigFiveScores(s.scoreBreakdown)
                          return bf ? <BigFiveMini scores={bf} /> : null
                        })()}
                        <span>· {formatDate(s.createdAt)}</span>
                        {s.sentBy && <span>· por {s.sentBy}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Expand chart button for submitted sessions */}
                      {s.submittedAt && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(s.id)}
                          title="Ver gráfico"
                          className="p-1.5 text-gray-400 hover:text-purple-600 rounded transition-colors"
                        >
                          {expandedId === s.id
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <BarChart3 className="h-3.5 w-3.5" />
                          }
                        </button>
                      )}
                      {!s.submittedAt && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir link"
                          className="p-1.5 text-gray-400 hover:text-purple-600 rounded transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => copyLink(s)}
                        title="Copiar link"
                        className="p-1.5 text-gray-400 hover:text-purple-600 rounded transition-colors"
                      >
                        {copiedId === s.id ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded chart panel */}
                {expandedId === s.id && s.submittedAt && (() => {
                  const kind = s.template?.kind ?? ""
                  const bf = bigFiveScores(s.scoreBreakdown)

                  if (kind === "PERSONALITY_BIG5" && bf) {
                    return (
                      <div className="border-t border-gray-100 bg-purple-50/50 p-4">
                        <p className="text-[11px] font-semibold text-purple-700 mb-3 flex items-center gap-1">
                          <BarChart3 className="h-3.5 w-3.5" /> Perfil Big Five
                        </p>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <div className="mx-auto sm:mx-0 shrink-0">
                            <BigFiveRadar scores={bf} size={200} />
                          </div>
                          <div className="flex-1">
                            <BigFiveBars scores={bf} />
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Technical / Screening score
                  return (
                    <div className="border-t border-gray-100 bg-gray-50 p-4">
                      <p className="text-[11px] font-semibold text-gray-600 mb-2">Resultado</p>
                      {s.score !== null && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Pontuação</span>
                            <span className="font-bold text-gray-800">{s.score}/100</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${s.outcome === "PASS" ? "bg-emerald-500" : s.outcome === "FAIL" ? "bg-red-400" : "bg-amber-400"}`}
                              style={{ width: `${s.score}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {s.outcome === "PENDING_REVIEW" && s.template?.kind !== "PERSONALITY_BIG5" && (
                        <p className="text-xs text-amber-700 mt-2">Aguardando revisão manual.</p>
                      )}
                    </div>
                  )
                })()}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
