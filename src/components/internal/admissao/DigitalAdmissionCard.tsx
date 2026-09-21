"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Link2, Copy, Check, MessageSquare, RefreshCw, Send, FileText, CalendarClock } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/ToastProvider'
import { DIGITAL_FORM_META, type DigitalFormState } from '@/lib/admissao/overview'

interface Props {
  admissionId: string
  state: DigitalFormState
  submittedAt: string | null
  tokenExpiresAt: string | null
  /** Link atual (só quando há token ativo) — permite copiar sem gerar outro. */
  currentUrl: string | null
  /** Validade de um link novo, em dias (mesma constante usada pela API). */
  expiryDays: number
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(',', ' às')
}

/**
 * Card da admissão digital. Mostra o estado real do formulário (não enviado, aguardando,
 * expirado, recebido) e só as datas que o backend guarda: validade e recebimento.
 * "Enviado em" e histórico de envios dependem de backend (ainda não registrados).
 */
export function DigitalAdmissionCard({ admissionId, state, submittedAt, tokenExpiresAt, currentUrl, expiryDays }: Props) {
  const router = useRouter()
  const { notify } = useToast()
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [whatsappMsg, setWhatsappMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<'url' | 'msg' | null>(null)

  const meta = DIGITAL_FORM_META[state]
  const url = generatedUrl ?? currentUrl

  async function generateLink() {
    setConfirmOpen(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/admissoes/${admissionId}/digital/start`, { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { error?: string; formUrl?: string; whatsappMessage?: string }
      if (!res.ok) {
        notify('error', body.error ?? 'Não foi possível gerar o link.')
        return
      }
      setGeneratedUrl(body.formUrl ?? null)
      setWhatsappMsg(body.whatsappMessage ?? null)
      notify('success', 'Link gerado. Copie e envie ao candidato.')
      router.refresh()
    } catch {
      notify('error', 'Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string, kind: 'url' | 'msg') {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(kind)
        notify('success', kind === 'url' ? 'Link copiado.' : 'Mensagem copiada.')
        setTimeout(() => setCopied(null), 2000)
      },
      () => notify('error', 'Não foi possível copiar. Selecione o link e copie manualmente.')
    )
  }

  return (
    <section aria-labelledby="digital-title" className="rounded-card border border-wg-border-lighter bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-wg-green-dark" aria-hidden />
        <h2 id="digital-title" className="text-sm font-semibold text-wg-ink">Admissão digital</h2>
        <StatusBadge tone={meta.tone} className="ml-auto">{meta.label}</StatusBadge>
      </div>

      <dl className="mb-3 space-y-1 text-meta">
        {state === 'SUBMITTED' && submittedAt && (
          <div className="flex gap-1.5"><dt className="text-wg-ink-muted">Recebido em</dt><dd className="font-medium text-wg-ink">{fmt(submittedAt)}</dd></div>
        )}
        {state === 'WAITING' && tokenExpiresAt && (
          <div className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
            <dt className="text-wg-ink-muted">Válido até</dt><dd className="font-medium text-wg-ink">{fmt(tokenExpiresAt)}</dd>
          </div>
        )}
        {state === 'EXPIRED' && tokenExpiresAt && (
          <div className="flex gap-1.5"><dt className="text-wg-ink-muted">Expirou em</dt><dd className="font-medium text-danger-fg">{fmt(tokenExpiresAt)}</dd></div>
        )}
        {state === 'NOT_SENT' && (
          <p className="text-wg-ink-muted">
            Gere um link para o candidato preencher os dados e enviar os documentos. Válido por {expiryDays} dias.
          </p>
        )}
      </dl>

      {state === 'SUBMITTED' ? (
        <Link href="?aba=dados" scroll={false} className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'w-full' })}>
          <FileText aria-hidden /> Ver dados cadastrais
        </Link>
      ) : (
        <div className="space-y-2">
          {url && state === 'WAITING' && (
            <div className="flex items-center gap-1 rounded-control border border-wg-border-lighter bg-wg-bg py-1 pl-2.5 pr-1">
              <span className="min-w-0 flex-1 truncate text-[12px] text-wg-ink-secondary" title={url}>{url}</span>
              <Button size="sm" variant="secondary" icon={copied === 'url' ? Check : Copy} onClick={() => copy(url, 'url')}>
                {copied === 'url' ? 'Copiado' : 'Copiar link'}
              </Button>
            </div>
          )}

          {whatsappMsg && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              icon={copied === 'msg' ? Check : MessageSquare}
              onClick={() => copy(whatsappMsg, 'msg')}
            >
              {copied === 'msg' ? 'Mensagem copiada' : 'Copiar mensagem para WhatsApp'}
            </Button>
          )}

          {state === 'NOT_SENT' && (
            <Button variant="primary" size="sm" className="w-full" icon={Send} loading={loading} onClick={generateLink}>
              Gerar link do formulário
            </Button>
          )}
          {state === 'EXPIRED' && (
            <Button variant="primary" size="sm" className="w-full" icon={RefreshCw} loading={loading} onClick={generateLink}>
              Gerar novo link
            </Button>
          )}
          {state === 'WAITING' && (
            <Button variant="tertiary" size="sm" className="w-full" icon={RefreshCw} loading={loading} onClick={() => setConfirmOpen(true)}>
              Gerar novo link
            </Button>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        variant="warning"
        title="Gerar um novo link?"
        message={`O link atual deixará de funcionar. O novo link vale por ${expiryDays} dias e precisa ser reenviado ao candidato.`}
        confirmLabel="Gerar novo link"
        onConfirm={generateLink}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}
