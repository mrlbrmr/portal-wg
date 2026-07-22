import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { templateInputSchema } from '@/lib/avaliacoes/schema'
import { ZodError } from 'zod'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const kind     = searchParams.get('kind')
  const subtype  = searchParams.get('subtype')
  const inactive = searchParams.get('inactive') === '1'

  const supabase = await createClient()
  let query = supabase
    .from('assessment_templates')
    .select('id, name, description, kind, subtype, estimatedMin, passingScore, isActive, createdAt, createdById')
    .order('createdAt', { ascending: false })

  if (!inactive) query = query.eq('isActive', true)
  if (kind)    query = query.eq('kind', kind)
  if (subtype) query = query.eq('subtype', subtype)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN_RH') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  let input
  try { input = templateInputSchema.parse(body) } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: e.errors }, { status: 422 })
    throw e
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('assessment_templates')
    .insert({ ...input, createdById: session.user.id })
    .select('id, name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
