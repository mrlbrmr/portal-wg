import type { InboundMessage, WhatsAppProviderAdapter } from '../types'

const GRAPH_API = 'https://graph.facebook.com/v19.0'

function metaHeaders() {
  return { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN!}`, 'Content-Type': 'application/json' }
}

interface MetaMessage {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string }
  document?: { id: string; mime_type: string; filename?: string }
  audio?: { id: string; mime_type: string }
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } }
}

export const metaAdapter: WhatsAppProviderAdapter = {
  parseInbound(body: unknown): InboundMessage | null {
    const b = body as Record<string, unknown>
    if (b.object !== 'whatsapp_business_account') return null

    const entry = ((b.entry as unknown[]) ?? [])[0] as Record<string, unknown> | undefined
    const change = ((entry?.changes as unknown[]) ?? [])[0] as Record<string, unknown> | undefined
    const value = change?.value as Record<string, unknown> | undefined
    const messages = (value?.messages as MetaMessage[]) ?? []
    const msg = messages[0]
    if (!msg) return null

    const messageId = msg.id
    const from = msg.from
    const timestamp = parseInt(msg.timestamp, 10) || Math.floor(Date.now() / 1000)

    if (msg.type === 'text' && msg.text) {
      return { messageId, from, type: 'text', text: msg.text.body, timestamp }
    }

    if (msg.type === 'interactive' && msg.interactive?.button_reply) {
      return { messageId, from, type: 'text', text: msg.interactive.button_reply.id, timestamp }
    }

    if (msg.type === 'image' && msg.image) {
      return { messageId, from, type: 'image', mediaId: msg.image.id, mimeType: msg.image.mime_type, fileName: `imagem_${messageId}.jpg`, timestamp }
    }

    if (msg.type === 'document' && msg.document) {
      return { messageId, from, type: 'document', mediaId: msg.document.id, mimeType: msg.document.mime_type, fileName: msg.document.filename ?? `doc_${messageId}`, timestamp }
    }

    if (msg.type === 'audio' && msg.audio) {
      return { messageId, from, type: 'audio', mediaId: msg.audio.id, mimeType: msg.audio.mime_type, timestamp }
    }

    return { messageId, from, type: 'unknown', timestamp }
  },

  async sendText(to: string, text: string): Promise<string | null> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
    const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: metaHeaders(),
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: text } }),
    })
    if (!res.ok) { console.error('[meta] sendText error:', await res.text().catch(() => res.status)); return null }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const msgs = data.messages as Array<Record<string, string>> | undefined
    return msgs?.[0]?.id ?? null
  },

  async sendButtons(to: string, body: string, buttons: Array<{ id: string; title: string }>): Promise<string | null> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
    const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: metaHeaders(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: { buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
        },
      }),
    })
    if (!res.ok) { console.error('[meta] sendButtons error:', await res.text().catch(() => res.status)); return null }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const msgs = data.messages as Array<Record<string, string>> | undefined
    return msgs?.[0]?.id ?? null
  },

  async downloadMedia(mediaId: string, _directUrl?: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    // Step 1: Get media URL
    const urlRes = await fetch(`${GRAPH_API}/${mediaId}`, { headers: metaHeaders() })
    if (!urlRes.ok) throw new Error(`[meta] media URL fetch failed: ${urlRes.status}`)
    const urlData = (await urlRes.json()) as Record<string, unknown>
    const mediaUrl = urlData.url as string
    if (!mediaUrl) throw new Error('[meta] no url in media response')

    // Step 2: Download the actual media
    const mediaRes = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN!}` } })
    if (!mediaRes.ok) throw new Error(`[meta] media download failed: ${mediaRes.status}`)
    const buffer = Buffer.from(await mediaRes.arrayBuffer())
    const mimeType = (urlData.mime_type as string | undefined) ?? mediaRes.headers.get('content-type')?.split(';')[0].trim() ?? 'application/octet-stream'
    const ext = mimeType.split('/')[1] ?? 'bin'
    return { buffer, mimeType, fileName: `doc_${Date.now()}.${ext}` }
  },
}
