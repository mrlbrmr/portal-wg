// Constantes e helpers do formulário de admissão digital

export const DOC_LABELS = {
  RG_CNH:       'RG/CNH - Frente e verso',
  CTPS:         'CTPS - Frente e verso ou CTPS Digital',
  RESIDENCIA:   'Comprovante de residência',
  ESCOLARIDADE: 'Comprovante de escolaridade',
  TITULO:       'Título de Eleitor',
  RESERVISTA:   'Certificado de reservista/dispensa do Exército',
  CERTIDAO_CIV: 'Certidão de casamento/união estável/averbação de divórcio',
  CERT_FILHOS:  'Certidão de nascimento/RG dos filhos',
  VACINACAO:    'Carteira de vacinação (filhos até 5 anos)',
  MATRICULA:    'Comprovante de matrícula (filhos 6-14 anos)',
  CONTA_ITAU:   'Comprovante de conta Itaú',
  MOPP:         'Certificado MOPP + CNH com observação',
  EMPILHADEIRA: 'Certificado Operador de Empilhadeira',
} as const

export type DocKey = keyof typeof DOC_LABELS

export const ALWAYS_REQUIRED: DocKey[] = ['RG_CNH', 'CTPS', 'RESIDENCIA', 'ESCOLARIDADE', 'TITULO']

export interface FormAnswers {
  gender: string
  maritalStatus: string
  hasChildren: boolean
  hasItauAccount: boolean
  isDriverOperator: boolean
}

export function getVisibleDocs(a: Partial<FormAnswers>): DocKey[] {
  const docs: DocKey[] = [...ALWAYS_REQUIRED]
  if (a.gender === 'Masculino') docs.push('RESERVISTA')
  if (a.maritalStatus && ['Casado(a)', 'União Estável', 'Divorciado(a)'].includes(a.maritalStatus))
    docs.push('CERTIDAO_CIV')
  if (a.hasChildren) docs.push('CERT_FILHOS', 'VACINACAO', 'MATRICULA')
  if (a.hasItauAccount) docs.push('CONTA_ITAU')
  if (a.isDriverOperator) docs.push('MOPP', 'EMPILHADEIRA')
  return docs
}

export const GENDER_OPTIONS   = ['Masculino', 'Feminino', 'Prefiro não informar'] as const
export const MARITAL_OPTIONS  = ['Solteiro(a)', 'Casado(a)', 'União Estável', 'Viúvo(a)', 'Divorciado(a)'] as const
export const COLOR_OPTIONS    = ['Branco(a)', 'Preto(a)', 'Pardo(a)', 'Indígena'] as const

export const DIGITAL_FORM_EXPIRY_DAYS = 7
