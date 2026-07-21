import { getWhatsAppProvider } from './providers'
import type { WhatsAppProviderName } from './types'

export interface DownloadedMedia {
  buffer: Buffer
  mimeType: string
  fileName: string
}

export async function downloadWhatsAppMedia(
  provider: WhatsAppProviderName,
  mediaId?: string,
  directUrl?: string
): Promise<DownloadedMedia> {
  const adapter = getWhatsAppProvider(provider)
  return adapter.downloadMedia(mediaId ?? '', directUrl)
}
