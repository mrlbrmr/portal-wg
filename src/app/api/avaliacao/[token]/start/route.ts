import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Marca o início do preenchimento (primeiro item respondido). Alimenta o status
 * "Em andamento" em Aplicações e o "Tempo de preenchimento" do resultado.
 * Idempotente: só grava se ainda não houver início nem envio.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('assessment_sessions')
    .update({ startedAt: new Date().toISOString() })
    .eq('token', token)
    .is('startedAt', null)
    .is('submittedAt', null)
    .is('invalidadoEm', null)

  if (error) return NextResponse.json({ error: 'Erro ao registrar início' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
