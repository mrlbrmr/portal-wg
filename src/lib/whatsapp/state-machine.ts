import { createAdminClient } from '@/lib/supabase/admin'
import { uploadAdmissionAttachment } from '@/lib/admissao/storage'
import { validateDocument, type DocumentType } from '@/lib/ai/document-validator'
import { sendText } from './sender'
import { updateSession, logMessage } from './session'
import { downloadWhatsAppMedia } from './media'
import { BOT, DOC_LABELS, DOC_ORDER, type DocType } from './messages'
import type { InboundMessage, WhatsAppSession, AdmissionState, SessionData } from './types'

// Normaliza texto de entrada para comparações
function normalizeText(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function isConfirmation(text: string): boolean {
  const n = normalizeText(text)
  return ['sim', 's', 'yes', '1', 'confirmar', 'confirmo', 'ok'].some((k) => n === k)
}

function isCancellation(text: string): boolean {
  const n = normalizeText(text)
  return ['nao', 'n', 'no', '2', 'cancelar', 'nao quero'].some((k) => n === k || n.startsWith(k + ' '))
}

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let check = (sum * 10) % 11
  if (check === 10 || check === 11) check = 0
  if (check !== parseInt(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  check = (sum * 10) % 11
  if (check === 10 || check === 11) check = 0
  return check === parseInt(digits[10])
}

function isValidDate(d: string): boolean {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return false
  const [, day, month, year] = m.map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  if (year < 1900 || year > new Date().getFullYear()) return false
  return true
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

function nextDocState(docsReceived: string[]): AdmissionState | null {
  for (const doc of DOC_ORDER) {
    if (!docsReceived.includes(doc)) {
      return `DOC_${doc}` as AdmissionState
    }
  }
  return null
}

function currentDocType(state: AdmissionState): DocType | null {
  for (const doc of DOC_ORDER) {
    if (state === `DOC_${doc}`) return doc as DocType
  }
  return null
}

// Fire-and-forget: roda em background após enviar "Recebido! Validando..."
async function runValidationAsync(
  session: WhatsAppSession,
  attachmentId: string,
  imageBase64: string,
  mimeType: string,
  docType: DocType
): Promise<void> {
  try {
    const result = await validateDocument(imageBase64, mimeType, docType as DocumentType, {
      name: session.data.declaredName,
      cpf: session.data.cpf,
      birthDate: session.data.birthDate,
    })

    const supabase = createAdminClient()

    // Atualiza o attachment com o resultado da IA
    await supabase.from('admission_attachments').update({
      aiValidationStatus: result.status,
      aiExtractedData: result.extractedData,
      aiModel: 'claude-haiku-4-5',
      aiValidatedAt: new Date().toISOString(),
    }).eq('id', attachmentId)

    // Registra no log de atividade
    if (session.admissionId) {
      await supabase.from('admission_activity_log').insert({
        admissionId: session.admissionId,
        entity: 'WHATSAPP_BOT',
        entityId: session.id,
        action: `DOC_VALIDATED_${result.status}`,
        description: `${DOC_LABELS[docType]}: ${result.status} (confiança ${Math.round(result.confidence * 100)}%)`,
        metadata: { docType, issues: result.issues, extractedData: result.extractedData },
      })
    }

    const newData: SessionData = { ...session.data }
    const docsReceived = [...(newData.docsReceived ?? [])]
    const docsApproved = [...(newData.docsApproved ?? [])]

    if (result.status === 'REJECTED') {
      const newRetry = (session.retryCount ?? 0) + 1
      if (newRetry >= 3) {
        // Limite de tentativas atingido
        await sendText(session.phone, BOT.maxRetriesExceeded, session.id, session.provider)
        await updateSession(session.id, { state: 'EXCEPTION', retryCount: newRetry })

        // Notifica RH
        if (session.admissionId) {
          const admission = await supabase.from('admissions').select('responsibleId, fullName').eq('id', session.admissionId).maybeSingle()
          const responsibleId = admission.data?.responsibleId
          const fullName = admission.data?.fullName ?? 'colaborador'
          if (responsibleId) {
            await supabase.from('admission_notifications').insert({
              userId: responsibleId,
              admissionId: session.admissionId,
              title: `Admissão digital — exceção: ${fullName}`,
              body: `O colaborador ${fullName} atingiu o limite de tentativas no documento ${DOC_LABELS[docType]}. Intervenção manual necessária.`,
            })
          }
        }
      } else {
        await sendText(session.phone, BOT.validationRejected(result.rejectionReason ?? 'Verifique a qualidade da imagem'), session.id, session.provider)
        await updateSession(session.id, { retryCount: newRetry })
      }
      return
    }

    // APPROVED ou NEEDS_REVIEW — avança para o próximo doc
    docsReceived.push(docType)
    if (result.status === 'APPROVED') {
      docsApproved.push(docType)
      await sendText(session.phone, BOT.validationApproved(DOC_LABELS[docType]), session.id, session.provider)
    } else {
      // NEEDS_REVIEW — notifica RH e segue
      await sendText(session.phone, BOT.validationNeedsReview(DOC_LABELS[docType]), session.id, session.provider)
      if (session.admissionId) {
        const admission = await supabase.from('admissions').select('responsibleId, fullName').eq('id', session.admissionId).maybeSingle()
        const responsibleId = admission.data?.responsibleId
        const fullName = admission.data?.fullName ?? 'colaborador'
        if (responsibleId) {
          await supabase.from('admission_notifications').insert({
            userId: responsibleId,
            admissionId: session.admissionId,
            title: `Revisão necessária: ${fullName} — ${DOC_LABELS[docType]}`,
            body: `${result.issues.join('; ')}`,
          })
        }
      }
    }

    newData.docsReceived = docsReceived
    newData.docsApproved = docsApproved

    const nextState = nextDocState(docsReceived)
    if (!nextState) {
      // Todos os docs recebidos
      await sendText(session.phone, BOT.done, session.id, session.provider)
      await updateSession(session.id, { state: 'DONE', data: newData, retryCount: 0 })
      if (session.admissionId) {
        await supabase.from('admission_activity_log').insert({
          admissionId: session.admissionId,
          entity: 'WHATSAPP_BOT',
          entityId: session.id,
          action: 'ADMISSION_DIGITAL_COMPLETE',
          description: 'Todos os documentos enviados pelo colaborador via WhatsApp.',
        })
      }
    } else {
      // Envia instrução do próximo doc
      await sendText(session.phone, getDocMessage(nextState), session.id, session.provider)
      await updateSession(session.id, { state: nextState, data: newData, retryCount: 0 })
    }
  } catch (err) {
    console.error('[state-machine:runValidationAsync] Error:', err)
    // Em caso de erro, tratar como NEEDS_REVIEW
    if (session.admissionId) {
      const supabase = createAdminClient()
      await supabase.from('admission_attachments').update({ aiValidationStatus: 'NEEDS_REVIEW' }).eq('id', attachmentId)
      const admission = await supabase.from('admissions').select('responsibleId, fullName').eq('id', session.admissionId).maybeSingle()
      const responsibleId = admission.data?.responsibleId
      if (responsibleId) {
        await supabase.from('admission_notifications').insert({
          userId: responsibleId,
          admissionId: session.admissionId,
          title: `Erro na validação: ${admission.data?.fullName} — ${DOC_LABELS[docType]}`,
          body: `Erro técnico na validação automática. Revisão manual necessária.`,
        })
      }
    }
    // Avança de qualquer forma para não travar o colaborador
    const newData: SessionData = { ...session.data, docsReceived: [...(session.data.docsReceived ?? []), docType] }
    await sendText(session.phone, BOT.validationNeedsReview(DOC_LABELS[docType]), session.id, session.provider)
    const nextState = nextDocState(newData.docsReceived!)
    if (!nextState) {
      await sendText(session.phone, BOT.done, session.id, session.provider)
      await updateSession(session.id, { state: 'DONE', data: newData })
    } else {
      await sendText(session.phone, getDocMessage(nextState), session.id, session.provider)
      await updateSession(session.id, { state: nextState, data: newData, retryCount: 0 })
    }
  }
}

function getDocMessage(state: AdmissionState): string {
  if (state === 'DOC_RG_CNH') return BOT.docRgCnh
  if (state === 'DOC_CPF_CARD') return BOT.docCpfCard
  if (state === 'DOC_ADDRESS') return BOT.docAddress
  if (state === 'DOC_PHOTO') return BOT.docPhoto
  return ''
}

export async function processMessage(session: WhatsAppSession, inbound: InboundMessage): Promise<void> {
  const { state, data, phone } = session
  const text = (inbound.text ?? '').trim()

  // Log da mensagem recebida
  await logMessage(session.id, 'INBOUND', inbound.type, text || inbound.mediaUrl || inbound.mediaId, undefined)

  // Estados terminais
  if (state === 'DONE' || state === 'EXCEPTION') return

  // Sessão expirada (defensivo — já filtrado no getActiveSession, mas por segurança)
  if (new Date(session.expiresAt) < new Date()) {
    await sendText(phone, BOT.sessionExpired, session.id, session.provider)
    return
  }

  if (state === 'WAITING_START') {
    // Primeira mensagem — inicia o fluxo
    await sendText(phone, BOT.greeting(), session.id, session.provider)
    await updateSession(session.id, { state: 'GREETING' })
    return
  }

  if (state === 'GREETING') {
    if (isCancellation(text)) {
      await sendText(phone, 'Ok, entendido. Se precisar de ajuda, entre em contato com o RH. 👋', session.id, session.provider)
      await updateSession(session.id, { state: 'EXCEPTION' })
      return
    }
    await sendText(phone, BOT.askName, session.id, session.provider)
    await updateSession(session.id, { state: 'COLLECT_NAME' })
    return
  }

  if (state === 'COLLECT_NAME') {
    if (!text || text.split(' ').length < 2) {
      await sendText(phone, 'Por favor, informe seu *nome completo* (nome e sobrenome).', session.id, session.provider)
      return
    }
    const newData = { ...data, declaredName: text }
    await updateSession(session.id, { state: 'COLLECT_CPF', data: newData })
    await sendText(phone, BOT.askCpf(text), session.id, session.provider)
    return
  }

  if (state === 'COLLECT_CPF') {
    const digits = text.replace(/\D/g, '')
    if (!isValidCpf(digits)) {
      await sendText(phone, 'CPF inválido. Por favor, informe apenas os *11 dígitos* do seu CPF.', session.id, session.provider)
      return
    }
    const newData = { ...data, cpf: digits }
    await updateSession(session.id, { state: 'COLLECT_BIRTHDATE', data: newData })
    await sendText(phone, BOT.askBirthDate, session.id, session.provider)
    return
  }

  if (state === 'COLLECT_BIRTHDATE') {
    if (!isValidDate(text)) {
      await sendText(phone, 'Data inválida. Use o formato *DD/MM/AAAA* (ex: 15/03/1990).', session.id, session.provider)
      return
    }
    const newData = { ...data, birthDate: text }
    await updateSession(session.id, { state: 'CONFIRM_PERSONAL', data: newData })
    await sendText(phone, BOT.confirmPersonal(newData.declaredName!, formatCpf(newData.cpf!), text), session.id, session.provider)
    return
  }

  if (state === 'CONFIRM_PERSONAL') {
    if (isCancellation(text)) {
      const newData = { ...data, declaredName: undefined, cpf: undefined, birthDate: undefined }
      await updateSession(session.id, { state: 'COLLECT_NAME', data: newData })
      await sendText(phone, BOT.askName, session.id, session.provider)
      return
    }
    await updateSession(session.id, { state: 'DOC_RG_CNH' })
    await sendText(phone, BOT.docRgCnh, session.id, session.provider)
    return
  }

  // Estados de coleta de documentos
  const docType = currentDocType(state)
  if (docType) {
    if (inbound.type === 'text') {
      // Ignorar texto durante coleta de doc — reenviar instrução
      await sendText(phone, `Por favor, envie a *${DOC_LABELS[docType]}* como uma foto ou arquivo.`, session.id, session.provider)
      return
    }

    if (inbound.type !== 'image' && inbound.type !== 'document') {
      await sendText(phone, `Formato não suportado. Envie a *${DOC_LABELS[docType]}* como uma foto (JPG/PNG) ou PDF.`, session.id, session.provider)
      return
    }

    // Ack imediato
    await sendText(phone, BOT.mediaReceived, session.id, session.provider)

    // Download + upload no background (fire-and-forget)
    void (async () => {
      try {
        const supabase = createAdminClient()

        // Busca o documentTypeId correspondente no banco
        const { data: docTypeRow } = await supabase
          .from('admission_document_types')
          .select('id')
          .ilike('name', `%${DOC_LABELS[docType].split('/')[0]}%`)
          .maybeSingle()

        const downloaded = await downloadWhatsAppMedia(session.provider, inbound.mediaId, inbound.mediaUrl)
        const file = new File([new Uint8Array(downloaded.buffer)], downloaded.fileName, { type: downloaded.mimeType })
        const admissionId = session.admissionId ?? 'unknown'

        const uploaded = await uploadAdmissionAttachment(file, admissionId)

        const base64 = downloaded.buffer.toString('base64')

        const { data: attachment } = await supabase.from('admission_attachments').insert({
          admissionId,
          documentTypeId: docTypeRow?.id ?? null,
          fileName: downloaded.fileName,
          blobUrl: uploaded.url,
          mimeType: downloaded.mimeType,
          sizeBytes: downloaded.buffer.length,
          uploadedById: null,
          aiValidationStatus: 'PENDING',
          whatsappSessionId: session.id,
        }).select('id').single()

        if (attachment?.id) {
          await runValidationAsync(session, attachment.id, base64, downloaded.mimeType, docType)
        }
      } catch (err) {
        console.error('[state-machine:processMessage:docDownload] Error:', err)
        await sendText(phone, 'Tivemos um problema ao receber seu documento. Por favor, tente enviar novamente.', session.id, session.provider)
      }
    })()

    return
  }

  // Estado desconhecido
  await sendText(phone, BOT.unknownMessage, session.id, session.provider)
}
