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
] as const

export type ConditionType = (typeof CONDITION_TYPES)[number]

export type DocCondition =
  | { type: 'always' }
  | { type: 'gender'; values: string[] }
  | { type: 'marital'; values: string[] }
  | { type: 'hasChildren' }
  | { type: 'hasItauAccount' }
  | { type: 'isDriverOperator' }

export const CONDITION_LABELS: Record<ConditionType, string> = {
  always:           'Sempre visível',
  gender:           'Conforme o gênero',
  marital:          'Conforme o estado civil',
  hasChildren:      'Se possui filhos',
  hasItauAccount:   'Se possui conta Itaú',
  isDriverOperator: 'Se é Motorista/Operador/Encarregado',
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
}

export function matchesCondition(cond: DocCondition, a: Partial<FormAnswers>): boolean {
  switch (cond.type) {
    case 'always':           return true
    case 'gender':           return !!a.gender && cond.values.includes(a.gender)
    case 'marital':          return !!a.maritalStatus && cond.values.includes(a.maritalStatus)
    case 'hasChildren':      return !!a.hasChildren
    case 'hasItauAccount':   return !!a.hasItauAccount
    case 'isDriverOperator': return !!a.isDriverOperator
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
    title: 'Admissão Digital',
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
    { key: 'RESERVISTA',   label: 'Certificado de reservista/dispensa do Exército',            required: false, condition: { type: 'gender', values: ['Masculino'] } },
    { key: 'RG_CNH_CONJUGE', label: 'RG/CNH do Cônjuge - Frente e verso',                      required: false, condition: { type: 'marital', values: ['Casado(a)'] } },
    { key: 'CERTIDAO_CIV', label: 'Certidão de casamento/união estável/averbação de divórcio', required: false, condition: { type: 'marital', values: ['Casado(a)', 'União Estável', 'Divorciado(a)'] } },
    { key: 'CERT_FILHOS',  label: 'Certidão de nascimento/RG dos filhos',                       required: false, condition: { type: 'hasChildren' } },
    { key: 'VACINACAO',    label: 'Carteira de vacinação (filhos até 5 anos)',                 required: false, condition: { type: 'hasChildren' } },
    { key: 'MATRICULA',    label: 'Comprovante de matrícula (filhos 6-14 anos)',               required: false, condition: { type: 'hasChildren' } },
    { key: 'CONTA_ITAU',   label: 'Comprovante de conta Itaú',                                 required: false, condition: { type: 'hasItauAccount' } },
    { key: 'MOPP',         label: 'Certificado MOPP + CNH com observação',                     required: false, condition: { type: 'isDriverOperator' } },
    { key: 'EMPILHADEIRA', label: 'Certificado Operador de Empilhadeira',                       required: false, condition: { type: 'isDriverOperator' } },
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
