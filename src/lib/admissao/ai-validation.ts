// Validação de documentos via Google Gemini (plano gratuito) — imagens e PDFs vão inline.
// DOC/DOCX e outros formatos → needs_review automático.

import { createAdminClient } from '@/lib/supabase/admin'
import { ATTACHMENTS_BUCKET } from '@/lib/admissao/storage'
import { describeGeminiError, generateJson, getGeminiApiKey, inlineFile } from '@/lib/ai/gemini'

const SUPPORTED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])

/** 'unavailable' = a IA não pôde rodar (reprocessável pelo botão "Validar novamente"). */
export type AiValidationOutcome = 'approved' | 'needs_review' | 'unavailable' | 'skipped'

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

  if (!SUPPORTED_MIMES.has(mimeType)) {
    await finish('needs_review', 'Formato sem validação automática — revisão manual necessária.')
    return 'skipped'
  }

  if (!getGeminiApiKey()) {
    console.warn('[ai-validation] GEMINI_API_KEY ausente — pulando validação')
    await finish('needs_review', 'IA não configurada (GEMINI_API_KEY ausente) — revisão manual necessária.')
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

  const prompt = `Você é assistente de RH validando documentos de admissão.
Analise o arquivo e diga se ele é um "${documentTypeName}" válido.
Verifique: (1) o tipo de documento corresponde ao esperado, (2) está legível e sem cortes, (3) não está vencido (quando o documento tiver validade).
Responda APENAS com JSON: {"valid": true|false, "reason": "motivo curto em português"}`

  let parsed: { valid?: boolean; reason?: string }
  try {
    parsed = await generateJson({ parts: [inlineFile(mimeType, base64), prompt], maxOutputTokens: 1024 })
  } catch (err) {
    console.error('[ai-validation]', err)
    const invalidResponse = err instanceof Error && err.message.startsWith('Resposta da IA inválida')
    await finish('needs_review', invalidResponse ? 'Resposta da IA inválida — revisão manual necessária.' : describeGeminiError(err))
    return invalidResponse ? 'needs_review' : 'unavailable'
  }

  const valid = parsed.valid === true
  await finish(valid ? 'approved' : 'needs_review', parsed.reason ?? '')
  return valid ? 'approved' : 'needs_review'
}
