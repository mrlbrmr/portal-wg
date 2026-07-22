import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TemplateEditor } from '@/components/internal/avaliacoes/TemplateEditor'
import type { Question } from '@/lib/avaliacoes/schema'

export const metadata: Metadata = { title: 'Editar Teste — Avaliações' }

export default async function EditarTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
      mode="edit"
      template={template}
      canManage={session?.user.role === 'ADMIN_RH'}
    />
  )
}
