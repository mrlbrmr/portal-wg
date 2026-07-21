// Instância lazy — NÃO instanciar no top-level (quebraria se ANTHROPIC_API_KEY não existir)

export type DocumentType = 'RG_CNH' | 'CPF_CARD' | 'ADDRESS_PROOF' | 'PHOTO_3X4'
export type ValidationStatus = 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED'

export interface ValidationResult {
  status: ValidationStatus
  confidence: number
  extractedData: {
    fullName?: string
    cpf?: string
    docNumber?: string
    birthDate?: string
    expiryDate?: string
    address?: string
  }
  issues: string[]
  rejectionReason?: string
}

const SYSTEM_PROMPT = `Você é um sistema de validação de documentos para admissão de funcionários. Analise a imagem enviada e retorne um JSON com o resultado da validação.

Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON.

Formato obrigatório:
{
  "status": "APPROVED" | "NEEDS_REVIEW" | "REJECTED",
  "confidence": 0.0-1.0,
  "extractedData": {
    "fullName": string | null,
    "cpf": string | null,
    "docNumber": string | null,
    "birthDate": "DD/MM/AAAA" | null,
    "expiryDate": "DD/MM/AAAA" | null,
    "address": string | null
  },
  "issues": ["string"],
  "rejectionReason": string | null
}

Regras:
- REJECTED: imagem ilegível, borrada, cortada, com reflexo forte, ou tipo de documento incorreto
- NEEDS_REVIEW: imagem legível mas dados divergem dos fornecidos, ou documento próximo do vencimento (< 30 dias)
- APPROVED: documento legível, válido e dados coerentes
- Para foto 3x4: verifique se é uma foto de rosto (não de documento)
- Não bloqueie por pequenas inconsistências de formatação (acentos, maiúsculas)`

const DOC_INSTRUCTIONS: Record<DocumentType, string> = {
  RG_CNH: 'Valide se é um RG ou CNH brasileiro. Extraia: nome completo, número do documento, data de nascimento, data de validade (se CNH).',
  CPF_CARD: 'Valide se é um cartão CPF ou folha da Receita Federal com CPF. Extraia: nome completo e número do CPF.',
  ADDRESS_PROOF: 'Valide se é um comprovante de endereço (conta de água, luz, gás, telefone ou extrato bancário) dos últimos 3 meses. Extraia: endereço completo.',
  PHOTO_3X4: 'Valide se é uma foto de rosto (3x4). Confirme que mostra uma pessoa real, com rosto visível, sem objetos cobrindo o rosto.',
}

function normalizeCpf(cpf?: string): string {
  return (cpf ?? '').replace(/\D/g, '')
}

function nameMatch(extracted?: string, declared?: string): boolean {
  if (!extracted || !declared) return true
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
  const a = normalize(extracted)
  const b = normalize(declared)
  if (a === b) return true
  // Tolerate partial match (first + last name match)
  const partsA = a.split(' ')
  const partsB = b.split(' ')
  if (partsA[0] === partsB[0] && partsA[partsA.length - 1] === partsB[partsB.length - 1]) return true
  return false
}

export async function validateDocument(
  imageBase64: string,
  mimeType: string,
  documentType: DocumentType,
  declaredData: { name?: string; cpf?: string; birthDate?: string }
): Promise<ValidationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: 'NEEDS_REVIEW', confidence: 0, extractedData: {}, issues: ['ANTHROPIC_API_KEY não configurado'], rejectionReason: undefined }
  }

  // PDFs não têm suporte direto a vision — encaminhar para revisão manual
  if (mimeType === 'application/pdf' || mimeType === 'application/msword' || mimeType.includes('word')) {
    return {
      status: 'NEEDS_REVIEW',
      confidence: 0.5,
      extractedData: {},
      issues: ['Documento em formato PDF/Word — revisão manual necessária'],
    }
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const userPrompt = `${DOC_INSTRUCTIONS[documentType]}\n\nDados declarados pelo colaborador:\n- Nome: ${declaredData.name ?? 'não informado'}\n- CPF: ${declaredData.cpf ?? 'não informado'}\n- Data de nascimento: ${declaredData.birthDate ?? 'não informada'}\n\nAnalise o documento na imagem e valide.`

  let raw: string
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: imageBase64 } },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    })
    raw = response.content[0].type === 'text' ? response.content[0].text : ''
  } catch (err) {
    console.error('[ai:validateDocument] Claude API error:', err)
    return { status: 'NEEDS_REVIEW', confidence: 0, extractedData: {}, issues: ['Erro na API de IA — revisão manual'] }
  }

  let parsed: ValidationResult
  try {
    parsed = JSON.parse(raw.trim()) as ValidationResult
  } catch {
    console.error('[ai:validateDocument] JSON parse error. Raw:', raw.slice(0, 200))
    return { status: 'NEEDS_REVIEW', confidence: 0, extractedData: {}, issues: ['Resposta da IA inválida — revisão manual'] }
  }

  // Cross-reference CPF
  if (parsed.status === 'APPROVED' && declaredData.cpf && parsed.extractedData?.cpf) {
    if (normalizeCpf(parsed.extractedData.cpf) !== normalizeCpf(declaredData.cpf)) {
      parsed.status = 'NEEDS_REVIEW'
      parsed.issues = [...(parsed.issues ?? []), 'CPF extraído diverge do CPF declarado']
    }
  }

  // Cross-reference name (loose match)
  if (parsed.status === 'APPROVED' && documentType !== 'PHOTO_3X4' && declaredData.name && parsed.extractedData?.fullName) {
    if (!nameMatch(parsed.extractedData.fullName, declaredData.name)) {
      parsed.status = 'NEEDS_REVIEW'
      parsed.issues = [...(parsed.issues ?? []), 'Nome extraído diverge do nome declarado']
    }
  }

  return parsed
}
