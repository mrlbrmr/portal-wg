import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TemplateEditor } from '@/components/internal/avaliacoes/TemplateEditor'
import type { Question } from '@/lib/avaliacoes/schema'

export const metadata: Metadata = { title: 'Teste — Banco de testes' }

export default async function EditarTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ modo?: string }>
}) {
  const [{ id }, { modo }] = await Promise.all([params, searchParams])
  const [session, supabase] = await Promise.all([auth(), createClient()])

  const { data, error } = await supabase
    .from('assessment_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) notFound()

  const template = data as {
    id: string
    name: string
    description: string | null
    kind: string
    subtype: string | null
    estimatedMin: number | null
    instructions: string | null
    passingScore: number | null
    isActive: boolean
    questions: Question[]
  }

  return (
    <TemplateEditor
      // Remonta ao alternar Visualizar ⇄ Editar (estado do formulário recomeça do banco).
      key={modo ?? 'editar'}
      mode="edit"
      template={{ ...template, passingScore: template.passingScore === null ? null : Number(template.passingScore) }}
      canManage={session?.user.role === 'ADMIN_RH'}
      viewOnly={modo === 'visualizar'}
    />
  )
}
