import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { DigitalForm } from './DigitalForm'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

export const metadata: Metadata = { title: 'Admissão Digital | WG Baterias' }

function Banner({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="max-w-lg mx-auto mt-20 px-4 text-center">
      <div className="mb-4 flex justify-center">{icon}</div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 text-sm">{body}</p>
    </div>
  )
}

export default async function AdmissaoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase  = createAdminClient()

  const { data: admission } = await supabase
    .from('admissions')
    .select('id, fullName, digitalFormExpiresAt, digitalFormSubmittedAt')
    .eq('digitalFormToken', token)
    .maybeSingle()

  if (!admission) {
    return (
      <Banner
        icon={<AlertTriangle className="w-10 h-10 text-red-400" />}
        title="Link inválido"
        body="Este link não existe ou foi removido. Entre em contato com o time de Gente & Gestão pelo (41) 99817-0054."
      />
    )
  }

  if (admission.digitalFormExpiresAt && new Date(admission.digitalFormExpiresAt as string) < new Date()) {
    return (
      <Banner
        icon={<AlertTriangle className="w-10 h-10 text-yellow-400" />}
        title="Link expirado"
        body="Este link não está mais disponível. Solicite um novo link ao time de Gente & Gestão pelo (41) 99817-0054."
      />
    )
  }

  if (admission.digitalFormSubmittedAt) {
    const submittedAt = new Date(admission.digitalFormSubmittedAt as string)
      .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
    return (
      <Banner
        icon={<CheckCircle2 className="w-10 h-10 text-green-500" />}
        title="Documentos já enviados!"
        body={`Você já enviou seus documentos em ${submittedAt}. O time de RH irá analisar e entrará em contato. Seja bem-vindo(a) à família WG! 💚`}
      />
    )
  }

  return (
    <DigitalForm
      token={token}
      candidateName={admission.fullName as string}
    />
  )
}
