// Validação de documentos via Claude Haiku (Anthropic) — vision nativa.
// Documentos de imagem (jpg/png/webp) são analisados; PDFs/DOC → needs_review automático.

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { ATTACHMENTS_BUCKET } from '@/lib/admissao/storage'

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function validateAttachmentWithAI(
  attachmentId: string,
  storagePath: string,
  mimeType: string,
  documentTypeName: string,
): Promise<void> {
  const supabase = createAdminClient()

  async function finish(status: string, reason: string) {
    await supabase.from('admission_attachments').update({
      aiStatus: status,
      aiReason: reason,
      aiCheckedAt: new Date().toISOString(),
    }).eq('id', attachmentId)
  }

  if (!IMAGE_MIMES.has(mimeType)) {
    await finish('needs_review', 'Arquivo PDF/DOC — revisão manual necessária.')
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[ai-validation] ANTHROPIC_API_KEY ausente — pulando validação')
    return
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .download(storagePath)

  if (dlErr || !blob) {
    await finish('needs_review', 'Erro ao baixar arquivo para validação.')
    return
  }

  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
  const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/webp'

  const prompt = `Você é assistente de RH validando documentos de admissão.
Analise a imagem e diga se ela é um "${documentTypeName}" válido.
Verifique: (1) o tipo de documento corresponde ao esperado, (2) está legível e sem cortes, (3) não está vencido.
Responda APENAS com JSON: {"valid": true|false, "reason": "motivo curto em português"}`

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const content = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSON não encontrado na resposta')

    const parsed = JSON.parse(match[0]) as { valid: boolean; reason: string }
    await finish(parsed.valid ? 'approved' : 'needs_review', parsed.reason ?? '')

  } catch (err) {
    console.error('[ai-validation]', err)
    await finish('needs_review', 'Erro na validação automática — revisão manual necessária.')
  }
}
