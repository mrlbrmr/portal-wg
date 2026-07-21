export type WhatsAppProviderName = 'meta' | 'zapi'

export type MessageType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'unknown'

export interface InboundMessage {
  messageId: string
  from: string        // phone in E.164 format (e.g. "5511999999999")
  type: MessageType
  text?: string
  mediaId?: string    // Meta: ID to fetch; Z-API: not used
  mediaUrl?: string   // Z-API: direct URL in payload
  mimeType?: string
  fileName?: string
  timestamp: number   // unix seconds
}

export interface WhatsAppProviderAdapter {
  parseInbound(body: unknown): InboundMessage | null
  sendText(to: string, text: string): Promise<string | null>  // returns provider message ID
  sendButtons(to: string, body: string, buttons: Array<{ id: string; title: string }>): Promise<string | null>
  downloadMedia(mediaId: string, directUrl?: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }>
}

export type AdmissionState =
  | 'WAITING_START'
  | 'GREETING'
  | 'COLLECT_NAME'
  | 'COLLECT_CPF'
  | 'COLLECT_BIRTHDATE'
  | 'CONFIRM_PERSONAL'
  | 'DOC_RG_CNH'
  | 'DOC_CPF_CARD'
  | 'DOC_ADDRESS'
  | 'DOC_PHOTO'
  | 'PROCESSING'
  | 'DONE'
  | 'EXCEPTION'

export interface SessionData {
  declaredName?: string
  cpf?: string
  birthDate?: string
  docsReceived?: string[]  // list of doc types received
  docsApproved?: string[]
}

export interface WhatsAppSession {
  id: string
  admissionId: string | null
  phone: string
  state: AdmissionState
  data: SessionData
  provider: WhatsAppProviderName
  retryCount: number
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export interface OutboundItem {
  type: 'text' | 'buttons'
  text?: string
  body?: string
  buttons?: Array<{ id: string; title: string }>
}
