// Resumo diário ao RH: candidatos que começaram o formulário de admissão e pararam.
// Chamado pelo cron /api/cron/formularios-parados (vercel.json). Regra em stalled-forms.ts.
//
// Destinatários: caixa do RH (RH_EMAIL) + responsáveis das admissões listadas.
// Cada admissão avisada ganha um FORM_STALLED_NOTIFIED no log — só depois do envio
// confirmado, para que uma falha do Resend seja tentada de novo no dia seguinte.

import type { SupabaseClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activity/log'
import { isValidEmail, rhInboxEmail, sendEmail } from '@/lib/email'
import { stalledAdmissionFormsEmail } from '@/lib/email-templates'
import { loadFormConfig } from './form-config-loader'
import { isFormStalled } from './stalled-forms'
import { formFillProgress } from './workspace'

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function fmt(iso: string): string {
  return new Date(iso)
    .toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', ' às')
}

interface Row {
  id: string
  fullName: string
  phone: string | null
  responsibleId: string | null
  digitalFormExpiresAt: string | null
  position: { name: string } | Array<{ name: string }> | null
  stage: { isFinal: boolean } | Array<{ isFinal: boolean }> | null
  attachments: Array<{ documentTypeId: string | null; createdAt: string; uploadedById: string | null }>
}

export interface StalledNotifyResult {
  pending: number
  stalled: number
  sent: boolean
  reason?: string
}

export async function notifyStalledAdmissionForms(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<StalledNotifyResult> {
  const { data, error } = await supabase
    .from('admissions')
    .select(
      `id, fullName, phone, responsibleId, digitalFormExpiresAt,
       position:admission_positions(name),
       stage:admission_stages(isFinal),
       attachments:admission_attachments(documentTypeId, createdAt, uploadedById)`
    )
    .is('digitalFormSubmittedAt', null)
    .not('digitalFormToken', 'is', null)
    .is('deletedAt', null)
  if (error) throw new Error(`admissões: ${error.message}`)

  const rows = (data ?? []) as unknown as Row[]
  if (rows.length === 0) return { pending: 0, stalled: 0, sent: false, reason: 'nothing_pending' }

  const [config, typesRes, noticesRes] = await Promise.all([
    loadFormConfig(),
    supabase.from('admission_document_types').select('id, name'),
    supabase
      .from('admission_activity_log')
      .select('admissionId, createdAt')
      .eq('action', 'FORM_STALLED_NOTIFIED')
      .in('admissionId', rows.map((r) => r.id)),
  ])
  const documentTypes = (typesRes.data ?? []) as Array<{ id: string; name: string }>
  const lastNotice = new Map<string, string>()
  for (const n of (noticesRes.data ?? []) as Array<{ admissionId: string; createdAt: string }>) {
    const prev = lastNotice.get(n.admissionId)
    if (!prev || new Date(n.createdAt) > new Date(prev)) lastNotice.set(n.admissionId, n.createdAt)
  }

  const stalled = rows.flatMap((r) => {
    // Anexos do link não têm usuário do RH.
    const candidateAttachments = (r.attachments ?? [])
      .filter((a) => !a.uploadedById)
      .map((a) => ({ documentTypeId: a.documentTypeId, createdAt: new Date(a.createdAt).toISOString() }))
    const fill = formFillProgress({ documents: config.documents, documentTypes, candidateAttachments })
    const stalledNow = isFormStalled(
      {
        submittedAt: null,
        hasToken: true,
        isFinal: !!one(r.stage)?.isFinal,
        lastUploadAt: fill?.lastUploadAt ?? null,
        lastNoticeAt: lastNotice.get(r.id) ?? null,
      },
      now
    )
    return stalledNow && fill ? [{ row: r, fill }] : []
  })
  if (stalled.length === 0) return { pending: rows.length, stalled: 0, sent: false, reason: 'nothing_stalled' }

  const recipients = new Set<string>()
  const rh = rhInboxEmail()
  if (isValidEmail(rh)) recipients.add(rh.trim().toLowerCase())
  const responsibleIds = [...new Set(stalled.map((s) => s.row.responsibleId).filter((v): v is string => !!v))]
  if (responsibleIds.length) {
    const { data: users } = await supabase.from('users').select('email, active').in('id', responsibleIds)
    for (const u of (users ?? []) as Array<{ email: string | null; active: boolean }>) {
      if (u.active && isValidEmail(u.email)) recipients.add(u.email.trim().toLowerCase())
    }
  }
  if (recipients.size === 0) {
    console.warn('[email] formulários parados: defina RH_EMAIL para receber o aviso.')
    return { pending: rows.length, stalled: stalled.length, sent: false, reason: 'no_recipient' }
  }

  const { subject, html } = stalledAdmissionFormsEmail({
    items: stalled.map(({ row, fill }) => {
      const expiresAt = row.digitalFormExpiresAt
      const expired = !!expiresAt && new Date(expiresAt) < now
      const rows: Array<[string, string]> = [
        ['Cargo', one(row.position)?.name ?? ''],
        ['Documentos obrigatórios', `${fill.requiredDone} de ${fill.requiredTotal} enviados`],
        ['Faltam', fill.missing.join('\n')],
        ['Último arquivo', fill.lastUploadAt ? fmt(fill.lastUploadAt) : ''],
        [
          'Link do formulário',
          !expiresAt ? '' : expired ? `Expirou em ${fmt(expiresAt)}: gere um novo na ficha` : `Válido até ${fmt(expiresAt)}`,
        ],
        ['Telefone', row.phone ?? ''],
      ]
      return { admissionId: row.id, candidateName: row.fullName, rows }
    }),
  })

  const result = await sendEmail({ to: [...recipients], subject, html })
  if (!result.sent) return { pending: rows.length, stalled: stalled.length, sent: false, reason: result.reason }

  await Promise.all(
    stalled.map(({ row, fill }) =>
      logActivity(supabase, {
        action: 'FORM_STALLED_NOTIFIED',
        entity: 'ADMISSION',
        entityId: row.id,
        admissionId: row.id,
        userId: null,
        description: `RH avisado por e-mail: formulário parado (${fill.requiredDone} de ${fill.requiredTotal} documentos obrigatórios)`,
        metadata: {
          subjectName: row.fullName,
          lastUploadAt: fill.lastUploadAt,
          requiredDone: fill.requiredDone,
          requiredTotal: fill.requiredTotal,
        },
      })
    )
  )

  return { pending: rows.length, stalled: stalled.length, sent: true }
}
