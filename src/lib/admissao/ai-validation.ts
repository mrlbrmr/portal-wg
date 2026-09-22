// Validação de documentos via Claude Haiku (Anthropic) — vision nativa para imagens e
// document block para PDFs. DOC/DOCX e outros formatos → needs_review automático.

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { ATTACHMENTS_BUCKET } from '@/lib/admissao/storage'

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const PDF_MIME = 'application/pdf'

/** Motivo gravado quando a IA não pôde rodar (reprocessável pelo botão "Validar novamente"). */
export type AiValidationOutcome = 'approved' | 'needs_review' | 'unavailable' | 'skipped'

/** Traduz falhas da API em um motivo que o RH entende (e sabe a quem recorrer). */
function describeApiError(err: unknown): string {
  const status = err instanceof Anthropic.APIError ? err.status : undefined
  const message = err instanceof Error ? err.message : String(err)
  if (/credit balance is too low/i.test(message))
    return 'IA indisponível: sem créditos na API da Anthropic. Revise manualmente ou valide novamente após recarregar os créditos.'
  if (status === 401 || status === 403)
    return 'IA indisponível: chave da API da Anthropic inválida. Revise manualmente.'
  if (status === 429 || status === 529 || (status !== undefined && status >= 500))
    return 'IA temporariamente indisponível. Tente validar novamente em alguns minutos.'
  return 'Erro na validação automática — revisão manual necessária.'
}

export async function validateAttachmentWithAI(
  attachmentId: string,
  storagePath: string,
  mimeType: string,
  documentTypeName: string,
): Promise<AiValidationOutcome> {
  const supabase = createAdminClient()

  async function finish(status: string, reason: string) {
    await supabase.from('admission_attachments').update({
      aiStatus: status,
      aiReason: reason,
      aiCheckedAt: new Date().toISOString(),
    }).eq('id', attachmentId)
  }

  const isImage = IMAGE_MIMES.has(mimeType)
  const isPdf = mimeType === PDF_MIME
  if (!isImage && !isPdf) {
    await finish('needs_review', 'Formato sem validação automática — revisão manual necessária.')
    return 'skipped'
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[ai-validation] ANTHROPIC_API_KEY ausente — pulando validação')
    await finish('needs_review', 'IA não configurada (ANTHROPIC_API_KEY ausente) — revisão manual necessária.')
    return 'unavailable'
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .download(storagePath)

  if (dlErr || !blob) {
    await finish('needs_review', 'Erro ao baixar arquivo para validação.')
    return 'needs_review'
  }

  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
  const fileBlock: Anthropic.ContentBlockParam = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: PDF_MIME, data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } }

  const prompt = `Você é assistente de RH validando documentos de admissão.
Analise o arquivo e diga se ele é um "${documentTypeName}" válido.
Verifique: (1) o tipo de documento corresponde ao esperado, (2) está legível e sem cortes, (3) não está vencido (quando o documento tiver validade).
Responda APENAS com JSON: {"valid": true|false, "reason": "motivo curto em português"}`

  let content: string
  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: prompt }] }],
    })
    content = response.content[0]?.type === 'text' ? response.content[0].text : ''
  } catch (err) {
    console.error('[ai-validation]', err)
    await finish('needs_review', describeApiError(err))
    return 'unavailable'
  }

  try {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSON não encontrado na resposta')
    const parsed = JSON.parse(match[0]) as { valid: boolean; reason: string }
    await finish(parsed.valid ? 'approved' : 'needs_review', parsed.reason ?? '')
    return parsed.valid ? 'approved' : 'needs_review'
  } catch (err) {
    console.error('[ai-validation] resposta inválida:', content.slice(0, 200), err)
    await finish('needs_review', 'Resposta da IA inválida — revisão manual necessária.')
    return 'needs_review'
  }
}
