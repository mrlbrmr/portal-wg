// Reprocessa os anexos que a IA não conseguiu verificar (aiStatus = 'unavailable') — chamado
// pelo cron diário. O Gemini gratuito oscila: o que falhou no envio costuma passar depois.
// Só arquivos recentes, sem decisão do RH e em formato que a IA lê (imagem/PDF).

import type { SupabaseClient } from '@supabase/supabase-js'
import { validateAttachmentWithAI, type AiValidationOutcome } from './ai-validation'

export const REPROCESS_MAX_PER_RUN = 20
export const REPROCESS_WINDOW_DAYS = 14

export async function reprocessUnverifiedAttachments(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<{ checked: number; approved: number; stillUnverified: number }> {
  const since = new Date(now.getTime() - REPROCESS_WINDOW_DAYS * 86_400_000).toISOString()
  const { data } = await supabase
    .from('admission_attachments')
    .select('id, blobUrl, mimeType, admission_document_types(name)')
    .eq('aiStatus', 'unavailable')
    .is('reviewStatus', null)
    .gte('createdAt', since)
    .or('mimeType.like.image/%,mimeType.eq.application/pdf')
    .order('createdAt', { ascending: false })
    .limit(REPROCESS_MAX_PER_RUN)

  const outcomes: AiValidationOutcome[] = []
  // Um por vez: o plano gratuito limita requisições por minuto.
  for (const r of (data ?? []) as Array<{
    id: string
    blobUrl: string
    mimeType: string | null
    admission_document_types: { name?: string } | { name?: string }[] | null
  }>) {
    const dt = r.admission_document_types
    const typeName = (Array.isArray(dt) ? dt[0]?.name : dt?.name) ?? 'documento'
    outcomes.push(await validateAttachmentWithAI(r.id, r.blobUrl, r.mimeType ?? '', typeName))
  }
  return {
    checked: outcomes.length,
    approved: outcomes.filter((o) => o === 'approved').length,
    stillUnverified: outcomes.filter((o) => o === 'unavailable').length,
  }
}
