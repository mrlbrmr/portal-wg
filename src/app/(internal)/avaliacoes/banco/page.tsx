import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TemplateBancoList } from '@/components/internal/avaliacoes/TemplateBancoList'

export const metadata: Metadata = { title: 'Banco de Testes — Avaliações' }

export default async function BancoPage() {
  const [session, supabase] = await Promise.all([auth(), createClient()])

  const { data } = await supabase
    .from('assessment_templates')
    .select('id, name, description, kind, subtype, estimatedMin, passingScore, isActive, createdAt, questions')
    .order('createdAt', { ascending: false })

  const isAdmin = session?.user.role === 'ADMIN_RH'

  return (
    <TemplateBancoList
      templates={(data ?? []) as Parameters<typeof TemplateBancoList>[0]['templates']}
      canManage={isAdmin}
    />
  )
}
