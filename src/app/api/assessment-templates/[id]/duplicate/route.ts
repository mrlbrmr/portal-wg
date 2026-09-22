import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/** Duplica um template do Banco de testes (nasce ativo, com "(cópia)" no nome). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN_RH') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createAdminClient()
  const { data: src } = await supabase
    .from('assessment_templates')
    .select('name, description, kind, subtype, estimatedMin, instructions, questions, passingScore, validityMonths')
    .eq('id', id)
    .maybeSingle()
  if (!src) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })

  const { data, error } = await supabase
    .from('assessment_templates')
    .insert({
      ...src,
      name: `${src.name as string} (cópia)`.slice(0, 200),
      isActive: true,
      createdById: session.user.id,
    })
    .select('id, name')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Erro ao duplicar o teste.' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
