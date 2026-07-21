import type { WhatsAppProviderAdapter, WhatsAppProviderName } from '../types'
import { zapiAdapter } from './zapi'
import { metaAdapter } from './meta'

export function getWhatsAppProvider(name?: WhatsAppProviderName): WhatsAppProviderAdapter {
  const provider = name ?? (process.env.WHATSAPP_PROVIDER as WhatsAppProviderName | undefined) ?? 'zapi'
  if (provider === 'meta') return metaAdapter
  return zapiAdapter
}
