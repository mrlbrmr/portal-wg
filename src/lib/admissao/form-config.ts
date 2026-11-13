// Configuração do formulário de admissão digital — editável pelo RH.
//
// Este módulo é PURO (sem dependências de servidor) para poder ser importado
// tanto pelo formulário público (client) quanto pelo editor e pelas rotas.
// O carregamento do banco fica em `form-config-loader.ts` (server-only).

import { z } from 'zod'

// ─── Condições de exibição de documentos ──────────────────────────────────────
// Cada documento aparece no formulário conforme a resposta do candidato.

export const CONDITION_TYPES = [
  'always',
  'gender',
  'marital',
  'hasChildren',
  'hasItauAccount',
  'isDriverOperator',
  'positionDriver',
  'positionForkliftOperator',
  'militaryAge',
] as const

export type ConditionType = (typeof CONDITION_TYPES)[number]

export type DocCondition =
  | { type: 'always' }
  | { type: 'gender'; values: string[] }
  | { type: 'marital'; values: string[] }
  | { type: 'hasChildren' }
  | { type: 'hasItauAccount' }
  | { type: 'isDriverOperator' }
  /** Pelo cargo da admissão (cadastro de Cargos); sem cargo, pela resposta do candidato. */
  | { type: 'positionDriver' }
  | { type: 'positionForkliftOperator' }
  /** Homem de 18 a 45 anos (reservista), pelo gênero e pela data de nascimento informados. */
  | { type: 'militaryAge' }

export const CONDITION_LABELS: Record<ConditionType, string> = {
  always:           'Sempre visível',
  gender:           'Conforme o gênero',
  marital:          'Conforme o estado civil',
  hasChildren:      'Se possui filhos',
  hasItauAccount:   'Se possui conta Itaú',
  isDriverOperator: 'Se é Motorista/Operador/Encarregado',
  positionDriver:   'Se o cargo é motorista',
  positionForkliftOperator: 'Se o cargo é operador de empilhadeira',
  militaryAge:      'Se é homem de 18 a 45 anos',
}

// ─── Campos extras (texto) anexados a um documento ────────────────────────────
// Ex.: número do PIS junto ao upload da CTPS.

export type ExtraFieldMask = 'none' | 'pis'

export interface ExtraFieldConfig {
  key: string
  label: string
  required: boolean
  placeholder?: string
  mask?: ExtraFieldMask
}

// ─── Documento do formulário ──────────────────────────────────────────────────

export interface DocumentConfig {
  key: string
  label: string
  required: boolean
  condition: DocCondition
  extraFields?: ExtraFieldConfig[]
}

// ─── Configuração completa ─────────────────────────────────────────────────────

export interface FormConfig {
  header: { title: string; subtitle: string }
  success: { title: string; body: string; contactPhone: string }
  genderOptions: string[]
  maritalOptions: string[]
  colorOptions: string[]
  labels: {
    maritalStatus: string
    hasChildren: string
    needsTransportVoucher: string
    transportVoucherDetails: string
    hasItauAccount: string
    colorDeclaration: string
    isDriverOperator: string
  }
  messages: { itauWarning: string; driverInfo: string }
  documents: DocumentConfig[]
}

// ─── Respostas usadas para avaliar as condições ───────────────────────────────

export interface FormAnswers {
  gender: string
  maritalStatus: string
  hasChildren: boolean
  hasItauAccount: boolean
  isDriverOperator: boolean
  /** Do cargo da admissão; ausentes quando a admissão não tem cargo. */
  isDriver?: boolean
  isForkliftOperator?: boolean
  /** AAAA-MM-DD — usada pela condição de idade militar. */
  birthDate?: string
}

/** Faixa de idade em que se pede o certificado de reservista. */
export const MILITARY_AGE = { min: 18, max: 45 } as const

function ageOn(birthIso: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthIso)) return null
  const [y, m, d] = birthIso.split('-').map(Number)
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1
  return age
}

export function matchesCondition(cond: DocCondition, a: Partial<FormAnswers>, now: Date = new Date()): boolean {
  switch (cond.type) {
    case 'always':           return true
    case 'gender':           return !!a.gender && cond.values.includes(a.gender)
    case 'marital':          return !!a.maritalStatus && cond.values.includes(a.maritalStatus)
    case 'hasChildren':      return !!a.hasChildren
    case 'hasItauAccount':   return !!a.hasItauAccount
    case 'isDriverOperator': return !!a.isDriverOperator
    case 'positionDriver':   return a.isDriver ?? !!a.isDriverOperator
    case 'positionForkliftOperator': return a.isForkliftOperator ?? !!a.isDriverOperator
    case 'militaryAge': {
      if (a.gender !== 'Masculino') return false
      // Sem data ainda (preenchida na etapa 1), segue só o gênero.
      const age = a.birthDate ? ageOn(a.birthDate, now) : null
      return age === null || (age >= MILITARY_AGE.min && age <= MILITARY_AGE.max)
    }
    default:                 return false
  }
}

export function getVisibleDocuments(config: FormConfig, a: Partial<FormAnswers>): DocumentConfig[] {
  return config.documents.filter((doc) => matchesCondition(doc.condition, a))
}

// ─── Configuração padrão (espelha o formulário atual) ─────────────────────────

export const GENDER_OPTIONS = ['Masculino', 'Feminino', 'Prefiro não informar']
export const MARITAL_OPTIONS = ['Solteiro(a)', 'Casado(a)', 'União Estável', 'Viúvo(a)', 'Divorciado(a)']
export const COLOR_OPTIONS = ['Branco(a)', 'Preto(a)', 'Pardo(a)', 'Indígena']

export const DIGITAL_FORM_EXPIRY_DAYS = 7

export const DEFAULT_FORM_CONFIG: FormConfig = {
  header: {
    title: 'Admissão digital',
    subtitle: 'Preencha com atenção.',
  },
  success: {
    title: 'Tudo certo! 🎉',
    body: 'Seus dados e documentos foram enviados com sucesso. O time de Gente & Gestão irá analisá-los e entrará em contato para os próximos passos. Seja bem-vindo(a) à família WG Baterias! 💚',
    contactPhone: '(41) 99817-0054',
  },
  genderOptions: [...GENDER_OPTIONS],
  maritalOptions: [...MARITAL_OPTIONS],
  colorOptions: [...COLOR_OPTIONS],
  labels: {
    maritalStatus: 'Estado civil',
    hasChildren: 'Possui filhos de até 21 anos?',
    needsTransportVoucher: 'Precisará de vale-transporte?',
    transportVoucherDetails: 'Quantas passagens por dia (ida e volta) e valor?',
    hasItauAccount: 'Possui conta no banco Itaú?',
    colorDeclaration: 'Autodeclaração de cor',
    isDriverOperator: 'Seu cargo será de Motorista, Operador ou Encarregado?',
  },
  messages: {
    itauWarning:
      'Trabalhamos apenas com o banco Itaú. Solicite orientações para abertura de conta salário ao time de Gente & Gestão.',
    driverInfo:
      'Para Motoristas, Operadores e Encarregados solicitamos o Certificado MOPP + CNH com observação e/ou Certificado de Operador de Empilhadeira.',
  },
  documents: [
    { key: 'RG_CNH',       label: 'RG/CNH - Frente e verso',                                   required: true,  condition: { type: 'always' } },
    {
      key: 'CTPS',
      label: 'CTPS - Frente e verso ou CTPS Digital',
      required: true,
      condition: { type: 'always' },
      extraFields: [
        { key: 'pisNumber', label: 'Número do PIS', required: false, placeholder: '000.00000.00-0', mask: 'pis' },
      ],
    },
    { key: 'RESIDENCIA',   label: 'Comprovante de residência',                                 required: true,  condition: { type: 'always' } },
    { key: 'ESCOLARIDADE', label: 'Comprovante de escolaridade',                               required: true,  condition: { type: 'always' } },
    { key: 'TITULO',       label: 'Título de Eleitor',                                          required: true,  condition: { type: 'always' } },
    { key: 'RESERVISTA',   label: 'Certificado de reservista/dispensa do Exército',            required: true,  condition: { type: 'militaryAge' } },
    { key: 'RG_CNH_CONJUGE', label: 'RG/CNH do Cônjuge - Frente e verso',                      required: false, condition: { type: 'marital', values: ['Casado(a)', 'União Estável'] } },
    { key: 'CERTIDAO_CIV', label: 'Certidão de casamento/união estável/averbação de divórcio', required: true,  condition: { type: 'marital', values: ['Casado(a)', 'União Estável', 'Divorciado(a)'] } },
    { key: 'CERT_FILHOS',  label: 'Certidão de nascimento/RG dos filhos',                       required: true,  condition: { type: 'hasChildren' } },
    { key: 'VACINACAO',    label: 'Carteira de vacinação (filhos até 5 anos)',                 required: false, condition: { type: 'hasChildren' } },
    { key: 'MATRICULA',    label: 'Comprovante de matrícula (filhos 6-14 anos)',               required: false, condition: { type: 'hasChildren' } },
    { key: 'CONTA_ITAU',   label: 'Comprovante de conta Itaú',                                 required: true,  condition: { type: 'hasItauAccount' } },
    { key: 'MOPP',         label: 'Certificado MOPP + CNH com observação',                     required: true,  condition: { type: 'positionDriver' } },
    { key: 'EMPILHADEIRA', label: 'Certificado Operador de Empilhadeira',                       required: false, condition: { type: 'positionForkliftOperator' } },
  ],
}

// ─── Validação (zod) ───────────────────────────────────────────────────────────

const conditionSchema = z.union([
  z.object({ type: z.literal('always') }),
  z.object({ type: z.literal('gender'), values: z.array(z.string()).default([]) }),
  z.object({ type: z.literal('marital'), values: z.array(z.string()).default([]) }),
  z.object({ type: z.literal('hasChildren') }),
  z.object({ type: z.literal('hasItauAccount') }),
  z.object({ type: z.literal('isDriverOperator') }),
  z.object({ type: z.literal('positionDriver') }),
  z.object({ type: z.literal('positionForkliftOperator') }),
  z.object({ type: z.literal('militaryAge') }),
])

const extraFieldSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(160),
  required: z.boolean(),
  placeholder: z.string().max(160).optional(),
  mask: z.enum(['none', 'pis']).optional(),
})

const documentSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(200),
  required: z.boolean(),
  condition: conditionSchema,
  extraFields: z.array(extraFieldSchema).optional(),
})

export const FormConfigSchema = z.object({
  header: z.object({ title: z.string().max(120), subtitle: z.string().max(240) }),
  success: z.object({
    title: z.string().max(120),
    body: z.string().max(1000),
    contactPhone: z.string().max(40),
  }),
  genderOptions: z.array(z.string().min(1).max(60)).min(1),
  maritalOptions: z.array(z.string().min(1).max(60)).min(1),
  colorOptions: z.array(z.string().min(1).max(60)).min(1),
  labels: z.object({
    maritalStatus: z.string().max(160),
    hasChildren: z.string().max(160),
    needsTransportVoucher: z.string().max(160),
    transportVoucherDetails: z.string().max(200),
    hasItauAccount: z.string().max(160),
    colorDeclaration: z.string().max(160),
    isDriverOperator: z.string().max(200),
  }),
  messages: z.object({ itauWarning: z.string().max(600), driverInfo: z.string().max(600) }),
  documents: z.array(documentSchema).min(1),
})

// Combina uma configuração parcial (vinda do banco) com os padrões, para ser
// resiliente a chaves ausentes / versões antigas.
export function mergeConfig(partial: unknown): FormConfig {
  const parsed = FormConfigSchema.safeParse(partial)
  if (parsed.success) return parsed.data as FormConfig
  return DEFAULT_FORM_CONFIG
}

// ─── Retomada do formulário ───────────────────────────────────────────────────
// Cada documento é gravado na hora do upload, mas as respostas só no envio final.
// Ao reabrir o link, os arquivos já enviados voltam para o documento de origem —
// o anexo é ligado ao cadastro "Tipos de documento" pelo rótulo exato (rota de upload).

export interface RestoredUpload {
  attachmentId: string
  fileName: string
}

export function restoreFormUploads(
  config: Pick<FormConfig, 'documents'>,
  documentTypes: Array<{ id: string; name: string }>,
  attachments: Array<{ id: string; fileName: string; documentTypeId: string | null; reviewStatus?: string | null }>
): Record<string, RestoredUpload[]> {
  const typeNameById = new Map(documentTypes.map((t) => [t.id, t.name]))
  const keyByLabel = new Map(config.documents.map((d) => [d.label, d.key]))
  const out: Record<string, RestoredUpload[]> = {}
  for (const a of attachments) {
    // Recusado pelo RH: o candidato precisa enviar outro arquivo.
    if (a.reviewStatus === 'rejected' || !a.documentTypeId) continue
    const name = typeNameById.get(a.documentTypeId)
    const key = name ? keyByLabel.get(name) : undefined
    if (!key) continue
    ;(out[key] ??= []).push({ attachmentId: a.id, fileName: a.fileName })
  }
  return out
}

// ─── Conferência no SERVIDOR do envio final ───────────────────────────────────
// A tela já bloqueia o envio sem documento obrigatório, mas a regra não pode morar só no
// navegador (aconteceram envios sem nenhum anexo). O submit recalcula os documentos
// visíveis pelas respostas recebidas e confere os anexos da admissão — os do candidato e
// os que o RH subiu por ele. Anexo recusado pelo RH ou descartado no envio não conta.

export interface MissingItem {
  key: string
  label: string
}

export function missingRequiredItems(
  config: Pick<FormConfig, 'documents'>,
  answers: Partial<FormAnswers>,
  documentTypes: Array<{ id: string; name: string }>,
  attachments: Array<{ id: string; fileName: string; documentTypeId: string | null; reviewStatus?: string | null }>,
  options: { abandonedIds?: readonly string[]; extras?: Record<string, string> | null } = {}
): { documents: MissingItem[]; fields: MissingItem[] } {
  const abandoned = new Set(options.abandonedIds ?? [])
  const uploads = restoreFormUploads(
    config,
    documentTypes,
    attachments.filter((a) => !abandoned.has(a.id))
  )
  const visible = getVisibleDocuments(config as FormConfig, answers)
  // Documento sem tipo correspondente no cadastro (vínculo é pelo nome exato) não dá para
  // conferir: o upload fica sem tipo. Nesse caso não bloqueia — senão o candidato travaria.
  const typeNames = new Set(documentTypes.map((t) => t.name))
  const documents = visible
    .filter((d) => d.required && typeNames.has(d.label) && !(uploads[d.key]?.length))
    .map((d) => ({ key: d.key, label: d.label }))
  const fields = visible.flatMap((d) =>
    (d.extraFields ?? [])
      .filter((f) => f.required && !(options.extras?.[f.key] ?? '').trim())
      .map((f) => ({ key: f.key, label: f.label }))
  )
  return { documents, fields }
}

/** Data de nascimento plausível para admissão: não futura e idade de 14 a 100 anos. */
export function birthDateProblem(iso: string, today: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Informe a data de nascimento.'
  const [y, m, d] = iso.split('-').map(Number)
  const ty = today.getFullYear(), tm = today.getMonth() + 1, td = today.getDate()
  // Comparação por AAAAMMDD: sem fuso nem horário.
  if (y * 10000 + m * 100 + d > ty * 10000 + tm * 100 + td) return 'A data de nascimento não pode ser no futuro.'
  let age = ty - y
  if (tm < m || (tm === m && td < d)) age -= 1
  if (age < 14) return 'Confira a data de nascimento: a idade mínima para admissão é 14 anos.'
  if (age > 100) return 'Confira a data de nascimento.'
  return null
}

/**
 * Prazo do link renovado por ATIVIDADE: cada documento enviado garante pelo menos
 * DIGITAL_FORM_EXPIRY_DAYS a partir de agora. Quem está enviando os documentos não perde
 * o link no meio; quem nunca abriu continua vencendo no prazo original. Nunca encurta.
 */
export function renewedFormExpiry(
  currentIso: string | null,
  now: Date = new Date(),
  days: number = DIGITAL_FORM_EXPIRY_DAYS
): string | null {
  const target = new Date(now.getTime() + days * 86_400_000)
  if (currentIso && new Date(currentIso).getTime() >= target.getTime()) return null
  return target.toISOString()
}

// ─── O cargo define uniforme e motorista/operador ─────────────────────────────
// Com cargo na admissão, o formulário não pergunta ao candidato o que o cadastro de Cargos
// já diz (calça e bota; motorista; operador de empilhadeira). Sem cargo, tudo como antes.

export interface PositionProfile {
  usesOperationalUniform: boolean
  isDriver: boolean
  isForkliftOperator: boolean
}

export function resolvePositionAnswers(
  profile: PositionProfile | null,
  candidate: { isDriverOperator: boolean | null; noOperationalUniform: boolean }
): {
  isDriverOperator: boolean
  isDriver?: boolean
  isForkliftOperator?: boolean
  noOperationalUniform: boolean
  asksDriverQuestion: boolean
  asksUniformQuestion: boolean
} {
  if (!profile) {
    return {
      isDriverOperator: !!candidate.isDriverOperator,
      noOperationalUniform: candidate.noOperationalUniform,
      asksDriverQuestion: true,
      asksUniformQuestion: true,
    }
  }
  return {
    isDriverOperator: profile.isDriver || profile.isForkliftOperator,
    isDriver: profile.isDriver,
    isForkliftOperator: profile.isForkliftOperator,
    noOperationalUniform: !profile.usesOperationalUniform,
    asksDriverQuestion: false,
    asksUniformQuestion: false,
  }
}
