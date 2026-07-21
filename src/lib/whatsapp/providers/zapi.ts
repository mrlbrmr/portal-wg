import type { InboundMessage, WhatsAppProviderAdapter } from '../types'

// Strip BOM (﻿) and whitespace — PowerShell pipe pode adicionar BOM silenciosamente
function clean(val: string | undefined): string {
  return (val ?? '').replace(/^﻿/, '').trim()
}

function zapiBase() {
  const instanceId = clean(process.env.ZAPI_INSTANCE_ID)
  const token = clean(process.env.ZAPI_TOKEN)
  return `https://api.z-api.io/instances/${instanceId}/token/${token}`
}

export const zapiAdapter: WhatsAppProviderAdapter = {
  parseInbound(body: unknown): InboundMessage | null {
    const b = body as Record<string, unknown>

    // Ignorar mensagens enviadas pelo próprio bot ou de grupos
    if (b.fromMe === true || b.isGroup === true) return null
    // Ignorar callbacks que não são de mensagem recebida
    if (b.type !== 'ReceivedCallback') return null

    const phone = (b.phone as string) ?? ''
    const messageId = (b.messageId as string) ?? ''
    const timestamp = typeof b.momment === 'number' ? Math.floor(b.momment / 1000) : Math.floor(Date.now() / 1000)

    // Text
    const textMsg = b.text as Record<string, string> | undefined
    if (textMsg?.message) {
      return { messageId, from: phone, type: 'text', text: textMsg.message, timestamp }
    }

    // Image
    const imageMsg = b.image as Record<string, unknown> | undefined
    if (imageMsg) {
      return {
        messageId,
        from: phone,
        type: 'image',
        mediaUrl: imageMsg.imageUrl as string | undefined,
        mimeType: (imageMsg.mimeType as string | undefined) ?? 'image/jpeg',
        fileName: `imagem_${messageId}.jpg`,
        timestamp,
      }
    }

    // Document
    const docMsg = b.document as Record<string, unknown> | undefined
    if (docMsg) {
      return {
        messageId,
        from: phone,
        type: 'document',
        mediaUrl: docMsg.documentUrl as string | undefined,
        mimeType: (docMsg.mimeType as string | undefined) ?? 'application/pdf',
        fileName: (docMsg.fileName as string | undefined) ?? `documento_${messageId}`,
        timestamp,
      }
    }

    // Audio / video / other — ignorar silenciosamente mas registrar
    return { messageId, from: phone, type: 'unknown', timestamp }
  },

  async sendText(to: string, text: string): Promise<string | null> {
    const res = await fetch(`${zapiBase()}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': clean(process.env.ZAPI_SECURITY_TOKEN) },
      body: JSON.stringify({ phone: to, message: text }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => res.status)
      console.error('[zapi] sendText error:', err)
      return null
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return (data.messageId as string | undefined) ?? null
  },

  async sendButtons(to: string, body: string, buttons: Array<{ id: string; title: string }>): Promise<string | null> {
    const res = await fetch(`${zapiBase()}/send-button-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': clean(process.env.ZAPI_SECURITY_TOKEN) },
      body: JSON.stringify({
        phone: to,
        message: body,
        buttonList: {
          buttons: buttons.map((b) => ({
            buttonId: b.id,
            buttonText: { displayText: b.title },
          })),
        },
      }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => res.status)
      console.error('[zapi] sendButtons error:', err)
      return null
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return (data.messageId as string | undefined) ?? null
  },

  async downloadMedia(_mediaId: string, directUrl?: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    if (!directUrl) throw new Error('[zapi] directUrl is required for media download')
    const res = await fetch(directUrl)
    if (!res.ok) throw new Error(`[zapi] media download failed: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
    const mimeType = contentType.split(';')[0].trim()
    const ext = mimeType.split('/')[1] ?? 'bin'
    return { buffer, mimeType, fileName: `doc_${Date.now()}.${ext}` }
  },
}
