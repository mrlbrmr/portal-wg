// Aviso ao RH quando o candidato conclui o formulário digital de admissão.
//
// Destinatários: caixa do RH (RH_EMAIL) + o responsável pela admissão, se houver.
// Roda dentro de `after()` na rota de envio: nunca bloqueia nem derruba a resposta
// ao candidato — sem Resend configurado, `sendEmail` só registra no log.

import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidEmail, rhInboxEmail, sendEmail } from '@/lib/email'
import { admissionSubmittedEmail } from '@/lib/email-templates'

type Named = { name: string } | Array<{ name: string }> | null

function nameOf(rel: Named): string {
  const v = Array.isArray(rel) ? rel[0] : rel
  return v?.name ?? ''
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : ''
}

export async function notifyAdmissionSubmitted(
  supabase: SupabaseClient,
  admissionId: string
): Promise<void> {
  const { data: a } = await supabase
    .from('admissions')
    .select(
      `id, fullName, email, phone, startDate, responsibleId,
       position:admission_positions(name),
       company:admission_companies(name),
       branch:admission_branches(name),
       attachments:admission_attachments(fileName, documentType:admission_document_types(name))`
    )
    .eq('id', admissionId)
    .maybeSingle()

  if (!a) return

  const recipients = new Set<string>()
  const rh = rhInboxEmail()
  if (isValidEmail(rh)) recipients.add(rh.trim().toLowerCase())

  if (a.responsibleId) {
    const { data: u } = await supabase
      .from('users')
      .select('email, active')
      .eq('id', a.responsibleId as string)
      .maybeSingle()
    if (u?.active && isValidEmail(u.email as string)) recipients.add((u.email as string).trim().toLowerCase())
  }

  if (recipients.size === 0) {
    console.warn('[email] admissão enviada: defina RH_EMAIL para receber o aviso.')
    return
  }

  // Agrupa os anexos por tipo de documento ("RG (2 arquivos)").
  const counts = new Map<string, number>()
  for (const att of (a.attachments ?? []) as Array<{ fileName: string; documentType: Named }>) {
    const label = nameOf(att.documentType) || att.fileName
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const documents = [...counts].map(([label, n]) => (n > 1 ? `${label} (${n} arquivos)` : label))

  const company = nameOf(a.company as Named)
  const branch = nameOf(a.branch as Named)

  const { subject, html } = admissionSubmittedEmail({
    admissionId: a.id as string,
    candidateName: a.fullName as string,
    documents,
    rows: [
      ['Candidato', a.fullName as string],
      ['Cargo', nameOf(a.position as Named)],
      ['Empresa / Unidade', [company, branch].filter(Boolean).join(' · ')],
      ['Data de admissão', formatDate(a.startDate as string | null)],
      ['Telefone', (a.phone as string | null) ?? ''],
      ['E-mail', (a.email as string | null) ?? ''],
    ],
  })

  const candidateEmail = a.email as string | null
  await sendEmail({
    to: [...recipients],
    subject,
    html,
    ...(isValidEmail(candidateEmail) ? { replyTo: candidateEmail } : {}),
  })
}
