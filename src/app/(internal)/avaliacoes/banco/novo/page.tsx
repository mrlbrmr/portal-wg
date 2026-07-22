import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { TemplateEditor } from '@/components/internal/avaliacoes/TemplateEditor'

export const metadata: Metadata = { title: 'Novo Teste — Avaliações' }

export default async function NovoTemplatePage() {
  const session = await auth()
  if (session?.user.role !== 'ADMIN_RH') redirect('/avaliacoes/banco')

  return <TemplateEditor mode="create" />
}
