import { getWhatsAppProvider } from './providers'
import { logMessage } from './session'
import type { WhatsAppProviderName } from './types'

export async function sendText(
  to: string,
  text: string,
  sessionId: string,
  providerName?: WhatsAppProviderName
): Promise<void> {
  const provider = getWhatsAppProvider(providerName)
  const msgId = await provider.sendText(to, text)
  await logMessage(sessionId, 'OUTBOUND', 'text', text, msgId)
}

export async function sendButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  sessionId: string,
  providerName?: WhatsAppProviderName
): Promise<void> {
  const provider = getWhatsAppProvider(providerName)
  const msgId = await provider.sendButtons(to, body, buttons)
  await logMessage(sessionId, 'OUTBOUND', 'buttons', body, msgId)
}
