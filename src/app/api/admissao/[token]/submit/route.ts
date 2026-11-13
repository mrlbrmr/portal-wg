import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity/log'
import { deleteAdmissionAttachment } from '@/lib/admissao/storage'
import { notifyAdmissionSubmitted } from '@/lib/admissao/notify-submitted'
import { advanceToDocumentIntake } from '@/lib/admissao/advance-document-intake'
import { z } from 'zod'
import { isValidCpf } from '@/lib/cpf'
import { loadFormConfig } from '@/lib/admissao/form-config-loader'
import { birthDateProblem, missingRequiredItems } from '@/lib/admissao/form-config'

// Nomes dos campos como o candidato os vê, para o erro dizer O QUE corrigir.
const FIELD_LABELS: Record<string, string> = {
  fullName: 'Nome completo', cpf: 'CPF', birthDate: 'Data de nascimento', email: 'E-mail',
  phone: 'Telefone / WhatsApp', gender: 'Gênero', maritalStatus: 'Estado civil',
  colorDeclaration: 'Autodeclaração de cor', uniformShirt: 'Tamanho da camiseta',
  bankAgency: 'Agência', bankAccount: 'Conta',
}

const schema = z.object({
  fullName:               z.string().trim().min(3).max(120),
  cpf:                    z.string().min(11).max(14).refine(isValidCpf, 'CPF inválido'),
  birthDate:              z.string().superRefine((v, ctx) => {
    const problem = birthDateProblem(v)
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem })
  }),
  email:                  z.string().email(),
  // Mesma regra da tela: DDD + número (10 ou 11 dígitos).
  phone:                  z.string().refine((v) => /^\d{10,11}$/.test(v.replace(/\D/g, '')), 'Telefone inválido'),
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
  uniformShirt:           z.string().min(1).max(20),
  noOperationalUniform:   z.boolean(),
  uniformPants:           z.string().max(20).nullable().optional(),
  uniformShoe:            z.string().max(20).nullable().optional(),
  formExtras:             z.record(z.string(), z.string().max(200)).nullable().optional(),
  abandonedAttachmentIds: z.array(z.string().uuid()).max(50).nullable().optional(),
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
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>
    const fields = Object.keys(fieldErrors).map((k) => FIELD_LABELS[k] ?? k)
    const birth = fieldErrors.birthDate?.[0]
    return NextResponse.json(
      {
        error: birth && fields.length === 1
          ? birth
          : `Confira ${fields.length === 1 ? 'o campo' : 'os campos'}: ${fields.join(', ')}.`,
        fields: Object.keys(fieldErrors),
      },
      { status: 422 }
    )
  }

  const d = parsed.data

  // A tela já exige os documentos obrigatórios, mas a regra não pode morar só no navegador:
  // recalcula o que é exigido pelas respostas e confere os anexos desta admissão.
  const [config, typesRes, attachmentsRes] = await Promise.all([
    loadFormConfig(),
    supabase.from('admission_document_types').select('id, name'),
    supabase
      .from('admission_attachments')
      .select('id, fileName, documentTypeId, reviewStatus')
      .eq('admissionId', admission.id),
  ])
  const missing = missingRequiredItems(
    config,
    {
      gender: d.gender,
      maritalStatus: d.maritalStatus,
      hasChildren: d.hasChildren,
      hasItauAccount: d.hasItauAccount,
      isDriverOperator: d.isDriverOperator,
    },
    (typesRes.data ?? []) as Array<{ id: string; name: string }>,
    (attachmentsRes.data ?? []) as Array<{ id: string; fileName: string; documentTypeId: string | null; reviewStatus: string | null }>,
    { abandonedIds: d.abandonedAttachmentIds ?? [], extras: d.formExtras ?? null }
  )
  if (missing.documents.length || missing.fields.length) {
    const parts = [
      ...(missing.documents.length ? [`documentos: ${missing.documents.map((m) => m.label).join(', ')}`] : []),
      ...(missing.fields.length ? [`campos: ${missing.fields.map((m) => m.label).join(', ')}`] : []),
    ]
    return NextResponse.json(
      {
        error: `Faltam itens obrigatórios — ${parts.join('; ')}. Volte à etapa Documentos e envie o que falta.`,
        missingDocuments: missing.documents.map((m) => m.key),
        missingFields: missing.fields.map((m) => m.key),
      },
      { status: 422 }
    )
  }

  // Compare-and-swap: só grava se ainda não foi enviado (clique duplo ou dois aparelhos
  // não geram dois envios, dois e-mails ao RH nem dois registros de atividade).
  const { data: saved, error } = await supabase.from('admissions').update({
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
    uniformShirt:           d.uniformShirt,
    noOperationalUniform:   d.noOperationalUniform,
    uniformPants:           d.uniformPants ?? null,
    uniformShoe:            d.uniformShoe ?? null,
    formExtras:             d.formExtras ?? null,
    digitalFormSubmittedAt: new Date().toISOString(),
  })
    .eq('id', admission.id)
    .is('digitalFormSubmittedAt', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[admissao-submit]', error)
    return NextResponse.json({ error: 'Erro ao salvar dados.' }, { status: 500 })
  }
  if (!saved) return NextResponse.json({ error: 'Formulário já enviado.' }, { status: 409 })

  await logActivity(supabase, {
    action: 'FORM_SUBMITTED',
    entity: 'ADMISSION',
    entityId: admission.id as string,
    admissionId: admission.id as string,
    userId: null,
    description: 'Formulário admissional enviado pelo candidato',
    metadata: { subjectName: d.fullName },
  })

  // Remove anexos abandonados (docs que deixaram de ser exigidos após mudança de
  // resposta). Restrito à própria admissão. Falha aqui não invalida o envio.
  if (d.abandonedAttachmentIds?.length) {
    try {
      const { data: rows } = await supabase
        .from('admission_attachments')
        .select('id, blobUrl')
        .eq('admissionId', admission.id)
        .in('id', d.abandonedAttachmentIds)

      for (const r of rows ?? []) {
        if (r.blobUrl) await deleteAdmissionAttachment(r.blobUrl as string)
      }
      if (rows?.length) {
        await supabase
          .from('admission_attachments')
          .delete()
          .eq('admissionId', admission.id)
          .in('id', rows.map((r) => r.id as string))
      }
    } catch (cleanupErr) {
      console.error('[admissao-submit] limpeza de anexos órfãos', cleanupErr)
    }
  }

  // Avisa o RH por e-mail depois de responder ao candidato (roda após a limpeza
  // acima, então a lista de documentos já reflete só os anexos válidos).
  const admissionId = admission.id as string
  after(() => advanceToDocumentIntake(supabase, admissionId, 'submit'))
  after(() =>
    notifyAdmissionSubmitted(supabase, admissionId).catch((err) =>
      console.error('[email] admissão enviada:', err)
    )
  )

  return NextResponse.json({ ok: true })
}
