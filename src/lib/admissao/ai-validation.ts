// Validação de documentos via Google Gemini (plano gratuito) — imagens e PDFs vão inline.
// DOC/DOCX e outros formatos → needs_review automático.

import { createAdminClient } from '@/lib/supabase/admin'
import { ATTACHMENTS_BUCKET } from '@/lib/admissao/storage'
import {
  AI_RETRY_DELAYS_MS,
  describeGeminiError,
  generateJson,
  getGeminiApiKey,
  inlineFile,
  isTransientGeminiError,
} from '@/lib/ai/gemini'

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
    // Formato que a IA não lê (DOC/DOCX…): não é problema no documento, só não foi verificado.
    await finish('unavailable', 'Formato sem verificação automática (envie em PDF ou foto para a IA conferir).')
    return 'skipped'
  }

  if (!getGeminiApiKey()) {
    console.warn('[ai-validation] GEMINI_API_KEY ausente — pulando validação')
    // Sem chave a IA não roda: "não verificado", nunca "revisar" (não há problema no arquivo).
    await finish('unavailable', 'IA não configurada (GEMINI_API_KEY ausente).')
    return 'unavailable'
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .download(storagePath)

  if (dlErr || !blob) {
    await finish('unavailable', 'Não foi possível abrir o arquivo para a verificação automática.')
    return 'unavailable'
  }

  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

  const prompt = `Você é assistente de RH validando documentos de admissão.
Analise o arquivo e diga se ele é um "${documentTypeName}" válido.
Verifique: (1) o tipo de documento corresponde ao esperado, (2) está legível e sem cortes, (3) não está vencido (quando o documento tiver validade).
Importante: o candidato costuma enviar frente e verso em ARQUIVOS SEPARADOS. Se o documento pede "frente e verso" e este arquivo mostra só um dos lados, considere válido — não reprove por falta do outro lado.
Responda APENAS com JSON: {"valid": true|false, "reason": "motivo curto em português"}`

  // O plano gratuito do Gemini oscila (5xx/limite): tenta de novo com espera crescente. Roda
  // depois da resposta ao candidato (after()), então a espera não trava ninguém.
  let parsed: { valid?: boolean; reason?: string } | null = null
  let lastErr: unknown = null
  for (const delay of AI_RETRY_DELAYS_MS) {
    if (delay) await new Promise((r) => setTimeout(r, delay))
    try {
      parsed = await generateJson({ parts: [inlineFile(mimeType, base64), prompt], maxOutputTokens: 1024 })
      break
    } catch (err) {
      lastErr = err
      const invalidResponse = err instanceof Error && err.message.startsWith('Resposta da IA inválida')
      if (!invalidResponse && !isTransientGeminiError(err)) break
    }
  }
  if (!parsed) {
    console.error('[ai-validation]', lastErr)
    // Falha técnica ≠ problema no documento: fica "não verificado" e o cron diário tenta de novo.
    const invalidResponse = lastErr instanceof Error && lastErr.message.startsWith('Resposta da IA inválida')
    await finish('unavailable', invalidResponse ? 'A IA respondeu em formato inesperado.' : describeGeminiError(lastErr))
    return 'unavailable'
  }

  const valid = parsed.valid === true
  await finish(valid ? 'approved' : 'needs_review', parsed.reason ?? '')
  return valid ? 'approved' : 'needs_review'
}
