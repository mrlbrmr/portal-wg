import { z } from 'zod'

export const templateKindEnum = z.enum(['SCREENING', 'TECHNICAL', 'PERSONALITY_BIG5'])
export type TemplateKind = z.infer<typeof templateKindEnum>

export const questionTypeEnum = z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_TEXT', 'SCALE_LIKERT'])
export type QuestionType = z.infer<typeof questionTypeEnum>

export const bigFiveDimensionEnum = z.enum(['O', 'C', 'E', 'A', 'N'])
export type BigFiveDimension = z.infer<typeof bigFiveDimensionEnum>

export const questionSchema = z.object({
  id: z.string().uuid(),
  type: questionTypeEnum,
  text: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  isReversed: z.boolean().optional(),
  bigFiveDimension: bigFiveDimensionEnum.optional(),
  weight: z.number().min(0).default(1),
})
export type Question = z.infer<typeof questionSchema>

export const templateInputSchema = z.object({
  name: z.string().min(2).max(200),
  kind: templateKindEnum,
  subtype: z.string().max(50).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  estimatedMin: z.number().int().positive().optional().nullable(),
  instructions: z.string().max(4000).optional().nullable(),
  questions: z.array(questionSchema).default([]),
  passingScore: z.number().min(0).max(100).optional().nullable(),
})
export type TemplateInput = z.infer<typeof templateInputSchema>

export const KIND_LABELS: Record<TemplateKind, string> = {
  SCREENING: 'Triagem',
  TECHNICAL: 'Técnico',
  PERSONALITY_BIG5: 'Personalidade (Big Five)',
}

export const KIND_COLORS: Record<TemplateKind, string> = {
  SCREENING: 'blue',
  TECHNICAL: 'orange',
  PERSONALITY_BIG5: 'purple',
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Múltipla escolha',
  TRUE_FALSE: 'Verdadeiro / Falso',
  SHORT_TEXT: 'Resposta curta',
  SCALE_LIKERT: 'Escala Likert (1-5)',
}

export const BIG5_LABELS: Record<BigFiveDimension, string> = {
  O: 'Abertura (O)',
  C: 'Conscienciosidade (C)',
  E: 'Extroversão (E)',
  A: 'Amabilidade (A)',
  N: 'Neuroticismo (N)',
}

export const LIKERT_OPTIONS = ['1 — Discordo totalmente', '2 — Discordo', '3 — Neutro', '4 — Concordo', '5 — Concordo totalmente']
