import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { getWhatsAppProvider } from '@/lib/whatsapp/providers'
import { getActiveSession } from '@/lib/whatsapp/session'
import { processMessage } from '@/lib/whatsapp/state-machine'
import { sendText } from '@/lib/whatsapp/sender'
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

  if (provider === 'zapi' && process.env.ZAPI_SECURITY_TOKEN) {
    if (clientToken !== process.env.ZAPI_SECURITY_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new NextResponse('ok', { status: 200 })
  }

  const adapter = getWhatsAppProvider(provider)
  const inbound = adapter.parseInbound(body)

  // Processar em background; SEMPRE retornar 200 imediatamente (< 2s)
  if (inbound && inbound.type !== 'unknown') {
    void (async () => {
      try {
        const session = await getActiveSession(inbound.from)
        if (!session) {
          // Mensagem inesperada — sem sessão ativa. Verificar se número tem admissão pendente.
          const supabase = createAdminClient()
          // Normaliza para busca (sem +55 prefix)
          const phoneSuffix = inbound.from.replace(/^\+?55/, '')
          const { data: admission } = await supabase
            .from('admissions')
            .select('id, fullName, responsibleId')
            .or(`phone.eq.${inbound.from},phone.eq.55${phoneSuffix},phone.eq.+55${phoneSuffix}`)
            .is('deletedAt', null)
            .order('createdAt', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (admission) {
            // Há admissão mas sem sessão — informar que o RH precisa iniciar
            // Não criar sessão aqui; apenas responder educadamente
            await supabase.from('whatsapp_admission_sessions').insert({
              phone: inbound.from,
              admissionId: admission.id,
              provider,
              state: 'WAITING_START',
            }).select('id').single().then(async ({ data: newSession }) => {
              if (!newSession) return
              // processMessage vai responder com greeting
              const createdSession = await getActiveSession(inbound.from)
              if (createdSession) await processMessage(createdSession, inbound)
            })
          } else {
            // Número desconhecido
            const dummySessionId = 'no-session'
            await getWhatsAppProvider(provider).sendText(inbound.from, BOT.notStarted).catch(() => {})
            console.log('[webhook] Unknown phone, sent notStarted:', inbound.from, dummySessionId)
          }
          return
        }
        await processMessage(session, inbound)
      } catch (err) {
        console.error('[webhook:processMessage] Error:', err)
      }
    })()
  }

  return new NextResponse('ok', { status: 200 })
}
