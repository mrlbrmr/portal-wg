"use client"

import { useState } from 'react'
import { MessageSquare, CheckCircle2, AlertTriangle, Clock, Loader2 } from 'lucide-react'
import { DOC_ORDER, DOC_LABELS } from '@/lib/whatsapp/messages'
import type { AdmissionState, SessionData } from '@/lib/whatsapp/types'

interface DigitalAdmissionSession {
  id: string
  state: AdmissionState
  data: SessionData
  createdAt: string
  updatedAt: string
  expiresAt: string
}

interface Props {
  admissionId: string
  session: DigitalAdmissionSession | null
  canManage: boolean
  hasPhone: boolean
}

const STATE_LABELS: Record<AdmissionState, string> = {
  WAITING_START: 'Aguardando início',
  GREETING: 'Saudação enviada',
  COLLECT_NAME: 'Coletando nome',
  COLLECT_CPF: 'Coletando CPF',
  COLLECT_BIRTHDATE: 'Coletando data de nascimento',
  CONFIRM_PERSONAL: 'Confirmando dados pessoais',
  DOC_RG_CNH: 'Aguardando RG/CNH',
  DOC_CPF_CARD: 'Aguardando Cartão CPF',
  DOC_ADDRESS: 'Aguardando comprovante de endereço',
  DOC_PHOTO: 'Aguardando foto 3x4',
  PROCESSING: 'Processando',
  DONE: 'Concluído',
  EXCEPTION: 'Exceção — requer intervenção',
}

function stateColor(state: AdmissionState): string {
  if (state === 'DONE') return 'bg-green-100 text-green-800'
  if (state === 'EXCEPTION') return 'bg-red-100 text-red-800'
  return 'bg-yellow-100 text-yellow-800'
}

function stateIcon(state: AdmissionState) {
  if (state === 'DONE') return <CheckCircle2 className="w-3.5 h-3.5" />
  if (state === 'EXCEPTION') return <AlertTriangle className="w-3.5 h-3.5" />
  return <Clock className="w-3.5 h-3.5" />
}

export function DigitalAdmissionCard({ admissionId, session, canManage, hasPhone }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  async function handleStart() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admissoes/${admissionId}/digital/start`, { method: 'POST' })
      const body = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) { setError(body.error ?? 'Erro ao iniciar admissão digital'); return }
      setStarted(true)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const docsReceived = session?.data?.docsReceived ?? []
  const docsApproved = session?.data?.docsApproved ?? []
  const progress = Math.round((docsReceived.length / DOC_ORDER.length) * 100)

  const showStart = canManage && hasPhone && !session && !started

  if (!session && !showStart) return null

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-wg-green-dark" />
        <h3 className="text-sm font-semibold text-gray-900">Admissão Digital via WhatsApp</h3>
      </div>

      {started && !session && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4" />
          Sessão iniciada! O colaborador receberá o WhatsApp em instantes.
        </div>
      )}

      {session && (
        <>
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium mb-3 ${stateColor(session.state)}`}>
            {stateIcon(session.state)}
            {STATE_LABELS[session.state]}
          </div>

          {/* Progresso de documentos */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Documentos</span>
              <span>{docsReceived.length}/{DOC_ORDER.length}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-wg-green h-1.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Lista de docs */}
          <div className="space-y-1 mb-3">
            {DOC_ORDER.map((doc) => {
              const received = docsReceived.includes(doc)
              const approved = docsApproved.includes(doc)
              return (
                <div key={doc} className="flex items-center gap-2 text-xs">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${received ? (approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700') : 'bg-gray-100 text-gray-400'}`}>
                    {received ? (approved ? '✓' : '~') : '○'}
                  </span>
                  <span className={received ? 'text-gray-700' : 'text-gray-400'}>{DOC_LABELS[doc]}</span>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-400">
            Última atividade: {new Date(session.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
          </p>
        </>
      )}

      {showStart && (
        <div className="mt-1">
          <button
            onClick={handleStart}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm font-medium bg-wg-green text-white hover:bg-wg-green-dark disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            {loading ? 'Iniciando...' : 'Iniciar admissão digital'}
          </button>
          <p className="text-xs text-gray-400 mt-1.5">Enviará uma mensagem WhatsApp ao colaborador.</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </div>
  )
}
