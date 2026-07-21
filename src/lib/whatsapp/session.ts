import { createAdminClient } from '@/lib/supabase/admin'
import type { AdmissionState, SessionData, WhatsAppProviderName, WhatsAppSession } from './types'

export async function createSession(
  phone: string,
  admissionId: string,
  provider: WhatsAppProviderName
): Promise<WhatsAppSession> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('whatsapp_admission_sessions')
    .insert({ phone, admissionId, provider, state: 'WAITING_START' })
    .select()
    .single()
  if (error || !data) throw new Error(`createSession failed: ${error?.message}`)
  return data as unknown as WhatsAppSession
}

export async function getActiveSession(phone: string): Promise<WhatsAppSession | null> {
  const supabase = createAdminClient()
  // Normaliza para os formatos possíveis que a Z-API pode enviar
  const digits = phone.replace(/\D/g, '')
  const candidates = Array.from(new Set([
    digits,
    digits.startsWith('55') ? digits : `55${digits}`,
    digits.startsWith('55') ? digits.slice(2) : digits,
  ]))

  const { data } = await supabase
    .from('whatsapp_admission_sessions')
    .select('*')
    .in('phone', candidates)
    .gt('expiresAt', new Date().toISOString())
    .not('state', 'in', '(DONE,EXCEPTION)')
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as unknown as WhatsAppSession | null
}

export async function updateSession(
  sessionId: string,
  patch: { state?: AdmissionState; data?: SessionData; retryCount?: number }
): Promise<void> {
  const supabase = createAdminClient()
  const update: Record<string, unknown> = {}
  if (patch.state !== undefined) update.state = patch.state
  if (patch.data !== undefined) update.data = patch.data
  if (patch.retryCount !== undefined) update.retryCount = patch.retryCount
  if (Object.keys(update).length === 0) return
  await supabase.from('whatsapp_admission_sessions').update(update).eq('id', sessionId)
}

export async function logMessage(
  sessionId: string,
  direction: 'INBOUND' | 'OUTBOUND',
  messageType: string,
  content?: string,
  providerMessageId?: string | null
): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('whatsapp_messages').insert({
    sessionId,
    direction,
    messageType,
    content: content ?? null,
    providerMessageId: providerMessageId ?? null,
  })
}
