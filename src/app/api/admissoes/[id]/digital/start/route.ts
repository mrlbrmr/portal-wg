import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSession, getActiveSession } from '@/lib/whatsapp/session'
import { sendText } from '@/lib/whatsapp/sender'
import { BOT } from '@/lib/whatsapp/messages'
import type { WhatsAppProviderName } from '@/lib/whatsapp/types'

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  // Adiciona +55 se não tem código de país
  if (!digits.startsWith('55') || digits.length <= 11) {
    digits = '55' + digits
  }
  return digits
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN_RH') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createAdminClient()

  const { data: admission, error } = await supabase
    .from('admissions')
    .select('id, fullName, phone, responsibleId')
    .eq('id', id)
    .is('deletedAt', null)
    .maybeSingle()

  if (error || !admission) {
    return NextResponse.json({ error: 'Admissão não encontrada' }, { status: 404 })
  }

  if (!admission.phone) {
    return NextResponse.json({ error: 'Esta admissão não tem telefone cadastrado.' }, { status: 422 })
  }

  const phone = normalizePhone(admission.phone)

  const existing = await getActiveSession(phone)
  if (existing) {
    return NextResponse.json({ error: 'Já existe uma sessão de admissão digital ativa para este colaborador.' }, { status: 409 })
  }

  const provider = (process.env.WHATSAPP_PROVIDER ?? 'zapi') as WhatsAppProviderName
  const wgSession = await createSession(phone, admission.id, provider)

  // Envia primeira mensagem
  await sendText(phone, BOT.greeting(admission.fullName), wgSession.id, provider)

  // Registra no log de atividade
  await supabase.from('admission_activity_log').insert({
    userId: session.user.id,
    admissionId: admission.id,
    entity: 'WHATSAPP_BOT',
    entityId: wgSession.id,
    action: 'DIGITAL_ADMISSION_STARTED',
    description: `Admissão digital iniciada pelo RH. Sessão: ${wgSession.id}`,
  })

  return NextResponse.json({ success: true, sessionId: wgSession.id }, { status: 201 })
}
