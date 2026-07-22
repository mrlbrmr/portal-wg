import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadAdmissionAttachment, validateAttachmentFile } from '@/lib/admissao/storage'
import { validateAttachmentWithAI } from '@/lib/admissao/ai-validation'
import { loadFormConfig } from '@/lib/admissao/form-config-loader'

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

  let form: FormData
  try { form = await req.formData() }
  catch { return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 }) }

  const file = form.get('file')
  if (!(file instanceof File))
    return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 400 })

  const check = validateAttachmentFile(file)
  if (!check.ok)
    return NextResponse.json({ error: check.error }, { status: 400 })

  const docKey   = (form.get('docKey') as string | null) ?? ''
  const config   = await loadFormConfig()
  const docLabel = config.documents.find((d) => d.key === docKey)?.label ?? null

  // Buscar ID do tipo de documento pelo nome
  let documentTypeId: string | null = null
  if (docLabel) {
    const { data: dt } = await supabase
      .from('admission_document_types')
      .select('id')
      .eq('name', docLabel)
      .maybeSingle()
    documentTypeId = dt?.id ?? null
  }

  let uploaded: Awaited<ReturnType<typeof uploadAdmissionAttachment>>
  try {
    uploaded = await uploadAdmissionAttachment(file, admission.id as string)
  } catch (err) {
    console.error('[admissao-upload]', err)
    return NextResponse.json({ error: 'Falha no upload. Tente novamente.' }, { status: 502 })
  }

  const { data: attachment } = await supabase
    .from('admission_attachments')
    .insert({
      admissionId:    admission.id,
      documentTypeId,
      fileName:       uploaded.name,
      blobUrl:        uploaded.url,
      mimeType:       uploaded.mimeType,
      sizeBytes:      uploaded.sizeBytes,
      aiStatus:       'pending',
    })
    .select('id')
    .single()

  if (attachment?.id) {
    const aid      = attachment.id as string
    const path     = uploaded.url
    const mime     = uploaded.mimeType
    const typeLabel = docLabel ?? 'documento'
    after(async () => {
      await validateAttachmentWithAI(aid, path, mime, typeLabel)
    })
  }

  return NextResponse.json({ attachmentId: attachment?.id, fileName: uploaded.name }, { status: 201 })
}
