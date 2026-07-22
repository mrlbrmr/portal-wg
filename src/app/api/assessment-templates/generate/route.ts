import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { Question } from '@/lib/avaliacoes/schema'

const bodySchema = z.object({
  jobTitle: z.string().min(2).max(200),
  jobDescription: z.string().max(3000).optional(),
  kind: z.enum(['SCREENING', 'TECHNICAL']),
  subtype: z.string().optional().nullable(),
  count: z.number().int().min(5).max(20).default(10),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN_RH') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 422 })

  const { jobTitle, jobDescription, kind, subtype, count } = parsed.data
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'IA não configurada.' }, { status: 503 })

  const kindLabel = kind === 'SCREENING' ? 'triagem comportamental/situacional' : `técnico de ${subtype ?? 'conhecimentos específicos'}`
  const prompt = `Você é especialista em recrutamento e seleção. Crie ${count} questões de múltipla escolha para um teste de ${kindLabel} para a vaga de "${jobTitle}".
${jobDescription ? `Contexto da vaga:\n${jobDescription}\n` : ''}
Regras:
- Cada questão deve ter exatamente 4 alternativas (A, B, C, D)
- Apenas uma alternativa é correta
- As questões devem ser objetivas e relevantes para a vaga
- Escreva em português brasileiro formal
- Responda APENAS com um array JSON no formato abaixo, sem texto adicional:
[
  {
    "text": "Texto da questão?",
    "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
    "correctAnswer": "Alternativa A"
  }
]`

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Array JSON não encontrado na resposta')

    const raw = JSON.parse(match[0]) as Array<{
      text: string
      options: string[]
      correctAnswer: string
    }>

    const questions: Question[] = raw.map((q) => ({
      id: crypto.randomUUID(),
      type: 'MULTIPLE_CHOICE' as const,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      weight: 1,
    }))

    return NextResponse.json({ questions })
  } catch (err) {
    console.error('[generate]', err)
    return NextResponse.json({ error: 'Erro ao gerar questões. Tente novamente.' }, { status: 500 })
  }
}
