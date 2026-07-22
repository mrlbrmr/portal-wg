"use client"

import { useState } from 'react'
import { Link2, CheckCircle2, Clock, Copy, Check, Loader2, MessageSquare, RefreshCw } from 'lucide-react'

interface Props {
  admissionId: string
  submittedAt: string | null
  tokenExpiresAt: string | null
  hasToken: boolean
}

export function DigitalAdmissionCard({ admissionId, submittedAt, tokenExpiresAt, hasToken }: Props) {
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [formUrl, setFormUrl]           = useState<string | null>(null)
  const [whatsappMsg, setWhatsappMsg]   = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl]       = useState(false)
  const [copiedMsg, setCopiedMsg]       = useState(false)

  const isExpired = tokenExpiresAt && new Date(tokenExpiresAt) < new Date()

  async function generateLink() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/admissoes/${admissionId}/digital/start`, { method: 'POST' })
      const body = await res.json().catch(() => ({})) as { error?: string; formUrl?: string; whatsappMessage?: string }
      if (!res.ok) { setError(body.error ?? 'Erro ao gerar link.'); return }
      setFormUrl(body.formUrl ?? null)
      setWhatsappMsg(body.whatsappMessage ?? null)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (submittedAt) {
    const dt = new Date(submittedAt).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
    })
    return (
      <div className="border border-green-200 rounded-xl p-4 bg-green-50">
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Formulário enviado</p>
            <p className="text-xs text-green-700">Recebido em {dt}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-wg-green-dark" />
        <h3 className="text-sm font-semibold text-gray-900">Admissão Digital</h3>
        {hasToken && !isExpired && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 rounded-full px-2 py-0.5">
            <Clock className="w-3 h-3" /> Aguardando candidato
          </span>
        )}
        {isExpired && (
          <span className="ml-auto text-xs text-red-600 bg-red-50 rounded-full px-2 py-0.5">Link expirado</span>
        )}
      </div>

      {/* Link já gerado */}
      {formUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-600 flex-1 truncate">{formUrl}</span>
            <button onClick={() => copy(formUrl, setCopiedUrl)}
              className="shrink-0 text-gray-500 hover:text-wg-green transition-colors">
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {whatsappMsg && (
            <button
              onClick={() => copy(whatsappMsg, setCopiedMsg)}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-medium bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors"
            >
              {copiedMsg
                ? <><Check className="w-3.5 h-3.5" /> Mensagem copiada!</>
                : <><MessageSquare className="w-3.5 h-3.5" /> Copiar mensagem WhatsApp</>}
            </button>
          )}
        </div>
      )}

      {/* Botão de geração */}
      {!formUrl && (
        <div>
          <button
            onClick={generateLink}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm font-medium bg-wg-green text-white hover:bg-wg-green-dark disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
              : isExpired
              ? <><RefreshCw className="w-4 h-4" /> Renovar link</>
              : hasToken
              ? <><RefreshCw className="w-4 h-4" /> Reenviar link</>
              : <><Link2 className="w-4 h-4" /> Gerar link de admissão</>}
          </button>
          <p className="text-xs text-gray-400 mt-1.5">
            Gera um link válido por 7 dias para o candidato preencher o formulário.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
