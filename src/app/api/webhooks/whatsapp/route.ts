import { NextRequest, NextResponse, after } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { getWhatsAppProvider } from '@/lib/whatsapp/providers'
import { getActiveSession } from '@/lib/whatsapp/session'
import { processMessage } from '@/lib/whatsapp/state-machine'
import { BOT } from '@/lib/whatsapp/messages'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — verificação de webhook Meta Cloud API
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — mensagens recebidas do WhatsApp (Z-API ou Meta)
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = rateLimit(ip, { limit: 300, windowMs: 60_000 })
  if (!allowed) return NextResponse.json({ error: 'rate limit' }, { status: 429 })

  // Verificação de segurança por token (Z-API: header; Meta: signature — simplificado)
  const clientToken = req.headers.get('client-token')
  const provider = (process.env.WHATSAPP_PROVIDER ?? 'zapi') as 'meta' | 'zapi'

  // Log para debug — remover após validação
  console.log('[webhook] client-token recebido:', clientToken)
  console.log('[webhook] ZAPI_SECURITY_TOKEN env:', process.env.ZAPI_SECURITY_TOKEN?.slice(0, 8))

  if (provider === 'zapi' && process.env.ZAPI_SECURITY_TOKEN) {
    const expectedToken = process.env.ZAPI_SECURITY_TOKEN.replace(/^﻿/, '').trim()
    if (clientToken !== expectedToken) {
      // Log apenas — não rejeitar ainda, até confirmar que Z-API envia o header
      console.warn('[webhook] Client-Token diverge. Recebido:', clientToken, '| Esperado:', expectedToken)
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new NextResponse('ok', { status: 200 })
  }

  console.log('[webhook] body recebido:', JSON.stringify(body).slice(0, 300))

  const adapter = getWhatsAppProvider(provider)
  const inbound = adapter.parseInbound(body)
  console.log('[webhook] inbound parseado:', inbound ? `type=${inbound.type} from=${inbound.from}` : 'null')

  if (!inbound || inbound.type === 'unknown') {
    // Loga body não reconhecido para diagnóstico
    await createAdminClient().from('admission_activity_log').insert({
      entity: 'WHATSAPP_BOT',
      action: 'WEBHOOK_UNRECOGNIZED',
      description: `Body não parseado: ${JSON.stringify(body).slice(0, 300)}`,
    }).catch(() => {})
  }

  // after() garante que o Vercel mantém a função viva até o processamento concluir
  if (inbound && inbound.type !== 'unknown') {
    after(async () => {
      try {
        const session = await getActiveSession(inbound.from)
        if (!session) {
          const supabase = createAdminClient()
          const phoneSuffix = inbound.from.replace(/^\+?55/, '')
          const { data: admission } = await supabase
            .from('admissions')
            .select('id, fullName, responsibleId')
            .or(`phone.eq.${inbound.from},phone.eq.55${phoneSuffix},phone.eq.+55${phoneSuffix}`)
            .is('deletedAt', null)
            .order('createdAt', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!admission) {
            // Log do número recebido para diagnóstico (ver admission_activity_log no Supabase)
            await createAdminClient().from('admission_activity_log').insert({
              entity: 'WHATSAPP_BOT',
              action: 'UNKNOWN_PHONE',
              description: `Número não encontrado: "${inbound.from}" (tipo: ${inbound.type})`,
            }).catch(() => {})
            await getWhatsAppProvider(provider).sendText(inbound.from, BOT.notStarted).catch(() => {})
          }
          return
        }
        await processMessage(session, inbound)
      } catch (err) {
        console.error('[webhook:processMessage] Error:', err)
      }
    })
  }

  return new NextResponse('ok', { status: 200 })
}
