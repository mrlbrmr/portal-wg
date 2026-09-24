import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyStalledAdmissionForms } from '@/lib/admissao/notify-stalled'

// Cron diário (vercel.json): resumo ao RH dos formulários de admissão parados no meio.
// A Vercel envia `Authorization: Bearer <CRON_SECRET>` — sem CRON_SECRET a rota não roda.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.warn('[cron] formulários parados: defina CRON_SECRET na Vercel para ativar o aviso.')
    return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const result = await notifyStalledAdmissionForms(createAdminClient())
    console.log('[cron] formulários parados', result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron] formulários parados', err)
    return NextResponse.json({ error: 'Falha ao verificar formulários.' }, { status: 500 })
  }
}
