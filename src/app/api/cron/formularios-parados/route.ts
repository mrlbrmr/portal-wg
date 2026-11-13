import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyStalledAdmissionForms } from '@/lib/admissao/notify-stalled'
import { reprocessUnverifiedAttachments } from '@/lib/admissao/ai-reprocess'

// Cron diário (vercel.json): resumo ao RH dos formulários de admissão parados no meio.
// A Vercel envia `Authorization: Bearer <CRON_SECRET>` — sem CRON_SECRET a rota não roda.

export const dynamic = 'force-dynamic'
// Reprocessar até 20 documentos com a IA (com novas tentativas) pode levar alguns minutos.
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.warn('[cron] formulários parados: defina CRON_SECRET na Vercel para ativar o aviso.')
    return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const supabase = createAdminClient()
    const result = await notifyStalledAdmissionForms(supabase)
    console.log('[cron] formulários parados', result)

    // Mesmo cron diário: tenta de novo a IA nos documentos que ela não conseguiu verificar.
    // Falha aqui não derruba o aviso dos formulários parados.
    let ai: Awaited<ReturnType<typeof reprocessUnverifiedAttachments>> | { error: string }
    try {
      ai = await reprocessUnverifiedAttachments(supabase)
      console.log('[cron] reprocessamento da IA', ai)
    } catch (err) {
      console.error('[cron] reprocessamento da IA', err)
      ai = { error: 'Falha ao reprocessar documentos.' }
    }
    return NextResponse.json({ ...result, ai })
  } catch (err) {
    console.error('[cron] formulários parados', err)
    return NextResponse.json({ error: 'Falha ao verificar formulários.' }, { status: 500 })
  }
}
