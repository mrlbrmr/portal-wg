import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveAssessmentType, type AssessmentType, type Question } from './schema'

/**
 * Linhas de aplicação de avaliação (uma sessão = um teste enviado a um candidato), já com
 * candidato, vaga e o TIPO efetivo da avaliação. Usado por Aplicações e Resultados.
 */
export interface AssessmentSessionRow {
  id: string
  token: string
  templateId: string
  templateName: string
  kind: string
  assessmentType: AssessmentType
  passingScore: number | null
  createdAt: string
  expiresAt: string | null
  startedAt: string | null
  submittedAt: string | null
  invalidadoEm: string | null
  score: number | null
  outcome: string | null
  scoreBreakdown: Record<string, unknown> | null
  sentBy: string | null
  applicationId: string | null
  candidateName: string
  candidateEmail: string
  jobId: string | null
  jobTitle: string | null
}

type RawSession = {
  id: string
  token: string
  templateId: string
  createdAt: string
  expiresAt: string | null
  startedAt: string | null
  submittedAt: string | null
  invalidadoEm: string | null
  score: number | string | null
  outcome: string | null
  scoreBreakdown: Record<string, unknown> | null
  sentBy: string | null
  applicationId: string | null
  template: { name: string; kind: string; assessmentType: string | null; passingScore: number | string | null } | null
  application: { fullName: string; email: string; jobId: string | null; job: { title: string } | null } | null
}

const SELECT =
  'id, token, templateId, createdAt, expiresAt, startedAt, submittedAt, invalidadoEm, score, outcome, scoreBreakdown, sentBy, applicationId, ' +
  'template:assessment_templates(name, kind, assessmentType, passingScore), ' +
  'application:applications(fullName, email, jobId, job:jobs(title))'

const num = (v: number | string | null) => (v === null || v === undefined ? null : Number(v))

function toRow(s: RawSession): AssessmentSessionRow {
  return {
    id: s.id,
    token: s.token,
    templateId: s.templateId,
    templateName: s.template?.name ?? 'Teste removido',
    kind: s.template?.kind ?? '',
    assessmentType: resolveAssessmentType({ assessmentType: s.template?.assessmentType, kind: s.template?.kind ?? '' }),
    passingScore: num(s.template?.passingScore ?? null),
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    startedAt: s.startedAt,
    submittedAt: s.submittedAt,
    invalidadoEm: s.invalidadoEm,
    score: num(s.score),
    outcome: s.outcome,
    scoreBreakdown: s.scoreBreakdown,
    sentBy: s.sentBy,
    applicationId: s.applicationId,
    candidateName: s.application?.fullName ?? '—',
    candidateEmail: s.application?.email ?? '',
    jobId: s.application?.jobId ?? null,
    jobTitle: s.application?.job?.title ?? null,
  }
}

export async function loadAssessmentSessions(
  supabase: SupabaseClient,
  opts: { submittedOnly?: boolean; limit?: number } = {},
): Promise<AssessmentSessionRow[]> {
  let query = supabase.from('assessment_sessions').select(SELECT)
  if (opts.submittedOnly) query = query.not('submittedAt', 'is', null)
  const { data, error } = await query
    .order(opts.submittedOnly ? 'submittedAt' : 'createdAt', { ascending: false })
    .limit(opts.limit ?? 500)
  if (error) throw new Error(`Erro ao carregar avaliações: ${error.message}`)
  return ((data ?? []) as unknown as RawSession[]).map(toRow)
}

export interface AssessmentSessionDetail extends AssessmentSessionRow {
  answers: Record<string, string>
  questions: Question[]
  gradedAt: string | null
  gradedBy: string | null
}

export async function loadAssessmentSession(
  supabase: SupabaseClient,
  id: string,
): Promise<AssessmentSessionDetail | null> {
  const { data, error } = await supabase
    .from('assessment_sessions')
    .select(SELECT.replace('passingScore)', 'passingScore, questions)') + ', answers, gradedAt, gradedBy')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  const raw = data as unknown as RawSession & {
    answers: Record<string, string> | null
    gradedAt: string | null
    gradedBy: string | null
  }
  const questions = ((raw.template as { questions?: Question[] } | null)?.questions ?? []) as Question[]
  const row = toRow(raw)
  return {
    ...row,
    // Recalcula com as questões quando a coluna do tipo ainda não existir.
    assessmentType: resolveAssessmentType({ assessmentType: raw.template?.assessmentType, kind: row.kind, questions }),
    answers: raw.answers ?? {},
    questions,
    gradedAt: raw.gradedAt,
    gradedBy: raw.gradedBy,
  }
}
