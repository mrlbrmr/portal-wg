import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// GET ?applicationId=... → lista sessões de um candidato
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const applicationId = req.nextUrl.searchParams.get('applicationId')
  if (!applicationId) return NextResponse.json({ error: 'applicationId obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assessment_sessions')
    .select('id, token, templateId, template:assessment_templates(name, kind, estimatedMin), expiresAt, startedAt, submittedAt, score, outcome, scoreBreakdown, sentBy, createdAt')
    .eq('applicationId', applicationId)
    .order('createdAt', { ascending: false })

  if (error) return NextResponse.json({ error: 'Erro ao buscar sessões' }, { status: 500 })
  return NextResponse.json({ sessions: data ?? [] })
}

const createSchema = z.object({
  applicationId: z.string().min(1),
  templateId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
})

// POST → cria nova sessão e retorna link público
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN_RH') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { applicationId, templateId, expiresInDays } = parsed.data

  const supabase = await createClient()

  // Valida que a candidatura existe
  const { data: app } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .maybeSingle()
  if (!app) return NextResponse.json({ error: 'Candidatura não encontrada' }, { status: 404 })

  // Valida que o template existe e está ativo
  const { data: template } = await supabase
    .from('assessment_templates')
    .select('id, isActive')
    .eq('id', templateId)
    .maybeSingle()
  if (!template || !template.isActive) {
    return NextResponse.json({ error: 'Template não encontrado ou inativo' }, { status: 404 })
  }

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
    : null

  const { data: newSession, error } = await supabase
    .from('assessment_sessions')
    .insert({
      applicationId,
      templateId,
      expiresAt,
      sentBy: session.user.name ?? session.user.email ?? 'Admin',
    })
    .select('id, token')
    .single()

  if (error || !newSession) {
    return NextResponse.json({ error: 'Erro ao criar sessão' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://carreiras.wgbaterias.com.br'
  return NextResponse.json({
    sessionId: newSession.id,
    token: newSession.token,
    url: `${baseUrl}/avaliacao/${newSession.token}`,
  }, { status: 201 })
}
