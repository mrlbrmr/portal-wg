import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { TestForm } from './TestForm'
import type { Question } from '@/lib/avaliacoes/schema'

export const metadata: Metadata = { title: 'Avaliação Online | WG Baterias' }

function Banner({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="max-w-lg mx-auto mt-20 px-4 text-center">
      <div className="mb-4 flex justify-center">{icon}</div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 text-sm">{body}</p>
    </div>
  )
}

export default async function AvaliacaoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: sess } = await supabase
    .from('assessment_sessions')
    .select('id, submittedAt, expiresAt, templateId, applicationId, score, outcome')
    .eq('token', token)
    .maybeSingle()

  if (!sess) {
    return (
      <Banner
        icon={<AlertTriangle className="w-10 h-10 text-red-400" />}
        title="Link inválido"
        body="Este link não existe ou foi removido. Entre em contato com o time de Gente & Gestão pelo (41) 99817-0054."
      />
    )
  }

  if (sess.expiresAt && new Date(sess.expiresAt as string) < new Date()) {
    return (
      <Banner
        icon={<AlertTriangle className="w-10 h-10 text-yellow-400" />}
        title="Link expirado"
        body="Este link não está mais disponível. Solicite um novo ao time de Gente & Gestão pelo (41) 99817-0054."
      />
    )
  }

  if (sess.submittedAt) {
    const submittedAt = new Date(sess.submittedAt as string).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    })
    return (
      <Banner
        icon={<CheckCircle2 className="w-10 h-10 text-green-500" />}
        title="Avaliação já enviada!"
        body={`Você já enviou suas respostas em ${submittedAt}. O time de RH irá analisar e entrará em contato em breve.`}
      />
    )
  }

  const { data: template } = await supabase
    .from('assessment_templates')
    .select('id, name, kind, estimatedMin, instructions, passingScore, questions')
    .eq('id', sess.templateId)
    .maybeSingle()

  if (!template) {
    return (
      <Banner
        icon={<AlertTriangle className="w-10 h-10 text-red-400" />}
        title="Avaliação indisponível"
        body="Não foi possível carregar esta avaliação. Entre em contato com o time de Gente & Gestão pelo (41) 99817-0054."
      />
    )
  }

  const { data: application } = await supabase
    .from('applications')
    .select('fullName')
    .eq('id', sess.applicationId)
    .maybeSingle()

  return (
    <TestForm
      token={token}
      sessionId={sess.id as string}
      candidateName={(application?.fullName as string | null) ?? ''}
      template={{
        name: template.name as string,
        kind: template.kind as string,
        estimatedMin: template.estimatedMin as number | null,
        instructions: template.instructions as string | null,
        passingScore: template.passingScore as number | null,
        questions: (template.questions as Question[]) ?? [],
      }}
    />
  )
}
