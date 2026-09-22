import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TemplateBancoList, type TemplateRow } from '@/components/internal/avaliacoes/TemplateBancoList'

export const metadata: Metadata = { title: 'Banco de testes — Avaliações' }

export default async function BancoPage() {
  const [session, supabase] = await Promise.all([auth(), createClient()])

  const [{ data }, { data: sent }] = await Promise.all([
    supabase
      .from('assessment_templates')
      .select('id, name, description, kind, subtype, assessmentType, estimatedMin, passingScore, isActive, createdAt, questions')
      .order('isActive', { ascending: false })
      .order('createdAt', { ascending: false }),
    // Contagem de aplicações por teste (tabela pequena; agrupa aqui).
    supabase.from('assessment_sessions').select('templateId'),
  ])

  const applications = new Map<string, number>()
  for (const s of (sent ?? []) as Array<{ templateId: string }>) {
    applications.set(s.templateId, (applications.get(s.templateId) ?? 0) + 1)
  }

  const templates: TemplateRow[] = ((data ?? []) as Array<Omit<TemplateRow, 'applications'>>).map((t) => ({
    ...t,
    passingScore: t.passingScore === null ? null : Number(t.passingScore),
    applications: applications.get(t.id) ?? 0,
  }))

  return <TemplateBancoList templates={templates} canManage={session?.user.role === 'ADMIN_RH'} />
}
