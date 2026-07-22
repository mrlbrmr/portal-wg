import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'
import { DIGITAL_FORM_EXPIRY_DAYS } from '@/lib/admissao/digital-form'

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

  const { data: admission } = await supabase
    .from('admissions')
    .select('id, fullName, digitalFormToken, digitalFormSubmittedAt')
    .eq('id', id)
    .is('deletedAt', null)
    .maybeSingle()

  if (!admission) {
    return NextResponse.json({ error: 'Admissão não encontrada' }, { status: 404 })
  }

  if (admission.digitalFormSubmittedAt) {
    return NextResponse.json({ error: 'Formulário já enviado pelo candidato.' }, { status: 409 })
  }

  // Reutiliza token existente ou gera novo
  const token      = (admission.digitalFormToken as string | null) ?? randomUUID()
  const expiresAt  = new Date(Date.now() + DIGITAL_FORM_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  await supabase.from('admissions').update({
    digitalFormToken:      token,
    digitalFormExpiresAt:  expiresAt.toISOString(),
  }).eq('id', id)

  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const formUrl  = `${baseUrl}/admissao/${token}`
  const name     = (admission.fullName as string).split(' ')[0]

  const whatsappMessage =
    `Olá, ${name}! 👋\n\n` +
    `Bem-vindo(a) à WG Baterias! 💚\n\n` +
    `Para continuar seu processo de admissão, acesse o link abaixo e preencha seus dados e documentos:\n\n` +
    `👉 ${formUrl}\n\n` +
    `⚠️ O link é pessoal e válido por ${DIGITAL_FORM_EXPIRY_DAYS} dias.\n` +
    `Em caso de dúvidas, fale com o time de Gente & Gestão: (41) 99817-0054\n\n` +
    `Seja bem-vindo(a) à família WG! 🚀`

  return NextResponse.json({ token, formUrl, whatsappMessage }, { status: 200 })
}
