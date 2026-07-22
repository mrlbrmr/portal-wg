import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  fullName:               z.string().trim().min(3).max(120),
  cpf:                    z.string().min(11).max(14),
  birthDate:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email:                  z.string().email(),
  phone:                  z.string().min(8).max(20),
  gender:                 z.string().min(1),
  maritalStatus:          z.string().min(1),
  hasChildren:            z.boolean(),
  needsTransportVoucher:  z.boolean(),
  transportVoucherDetails: z.string().max(500).nullable().optional(),
  hasItauAccount:         z.boolean(),
  bankAgency:             z.string().max(20).nullable().optional(),
  bankAccount:            z.string().max(30).nullable().optional(),
  colorDeclaration:       z.string().min(1),
  isDriverOperator:       z.boolean(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase  = createAdminClient()

  const { data: admission } = await supabase
    .from('admissions')
    .select('id, digitalFormExpiresAt, digitalFormSubmittedAt')
    .eq('digitalFormToken', token)
    .maybeSingle()

  if (!admission)
    return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })
  if (admission.digitalFormSubmittedAt)
    return NextResponse.json({ error: 'Formulário já enviado.' }, { status: 409 })
  if (admission.digitalFormExpiresAt && new Date(admission.digitalFormExpiresAt as string) < new Date())
    return NextResponse.json({ error: 'Link expirado.' }, { status: 410 })

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Dados inválidos.', issues: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data

  const { error } = await supabase.from('admissions').update({
    fullName:               d.fullName,
    cpf:                    d.cpf,
    birthDate:              d.birthDate,
    email:                  d.email,
    phone:                  d.phone,
    gender:                 d.gender,
    maritalStatus:          d.maritalStatus,
    hasChildren:            d.hasChildren,
    needsTransportVoucher:  d.needsTransportVoucher,
    transportVoucherDetails: d.transportVoucherDetails ?? null,
    hasItauAccount:         d.hasItauAccount,
    bankAgency:             d.bankAgency ?? null,
    bankAccount:            d.bankAccount ?? null,
    colorDeclaration:       d.colorDeclaration,
    isDriverOperator:       d.isDriverOperator,
    digitalFormSubmittedAt: new Date().toISOString(),
  }).eq('id', admission.id)

  if (error) {
    console.error('[admissao-submit]', error)
    return NextResponse.json({ error: 'Erro ao salvar dados.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
