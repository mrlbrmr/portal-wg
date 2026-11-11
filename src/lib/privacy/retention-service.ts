// Retenção LGPD — casos de uso (servidor). Regras puras em retention.ts.
//
// Anonimizar = redigir os dados pessoais e apagar os arquivos, MANTENDO as linhas do
// funil (vaga, etapa, datas, origem) para as métricas. Ordem: apaga arquivos primeiro
// (se falhar, nada muda no banco e a próxima execução tenta de novo) e só então grava.
// Sempre via service-role, depois de exigir ADMIN_RH na camada de cima.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ANON_NAME,
  DEFAULT_RETENTION_MONTHS,
  anonymizedEmail,
  normalizeRetentionMonths,
  retentionCutoff,
  retentionStatus,
  type RetentionBlockReason,
} from './retention'

const RESUMES_BUCKET = 'resumes'
const ASSESSMENT_BUCKET = 'assessment-files'

export interface RetentionActor {
  id: string | null
  name: string
}

export interface RetentionRow {
  id: string
  nomeCompleto: string
  email: string
  cargoDesejado: string | null
  lastActivityAt: string
  dueAt: string
  eligible: boolean
  reason: RetentionBlockReason | null
  retencaoBloqueioMotivo: string | null
}

export async function getRetentionMonths(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from('retention_settings').select('months').eq('id', 1).maybeSingle()
  return data ? normalizeRetentionMonths(data.months) : DEFAULT_RETENTION_MONTHS
}

interface CrmRow {
  id: string
  nomeCompleto: string
  email: string
  cargoDesejado: string | null
  processosAbertos: number
  contratado: boolean
  ultimaAtividadeEm: string | null
  ultimaCandidaturaEm: string | null
  createdAt: string
}

/**
 * Talentos parados além do prazo (elegíveis) e os "quase": bloqueados por motivo
 * jurídico, que o RH precisa ver para não achar que sumiram.
 */
export async function listRetentionRows(
  supabase: SupabaseClient,
  months: number,
  now: Date = new Date()
): Promise<RetentionRow[]> {
  const cutoff = retentionCutoff(now, months).toISOString()
  const { data: crm, error } = await supabase
    .from('talentos_crm')
    .select('id, nomeCompleto, email, cargoDesejado, processosAbertos, contratado, ultimaAtividadeEm, ultimaCandidaturaEm, createdAt')
    .lte('ultimaAtividadeEm', cutoff)
    .order('ultimaAtividadeEm', { ascending: true })
    .limit(1000)
  if (error) throw new Error(error.message)
  const rows = (crm ?? []) as CrmRow[]
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const [flagsRes, appsRes] = await Promise.all([
    supabase
      .from('talentos')
      .select('id, anonimizadoEm, retencaoBloqueadaEm, retencaoBloqueioMotivo')
      .in('id', ids),
    supabase.from('applications').select('id, talentoId').in('talentoId', ids),
  ])
  // Falha de leitura NUNCA pode virar "sem vínculo": abortar é o lado seguro.
  if (flagsRes.error) throw new Error(flagsRes.error.message)
  if (appsRes.error) throw new Error(appsRes.error.message)
  const flags = new Map((flagsRes.data ?? []).map((f) => [f.id as string, f]))
  const appToTalent = new Map(
    ((appsRes.data ?? []) as Array<{ id: string; talentoId: string }>).map((a) => [a.id, a.talentoId])
  )
  const withAdmission = new Set<string>()
  if (appToTalent.size > 0) {
    const admRes = await supabase
      .from('admissions')
      .select('sourceApplicationId')
      .in('sourceApplicationId', [...appToTalent.keys()])
    if (admRes.error) throw new Error(admRes.error.message)
    for (const a of (admRes.data ?? []) as Array<{ sourceApplicationId: string }>) {
      const tid = appToTalent.get(a.sourceApplicationId)
      if (tid) withAdmission.add(tid)
    }
  }

  const out: RetentionRow[] = []
  for (const r of rows) {
    const f = flags.get(r.id)
    const st = retentionStatus(
      {
        anonimizadoEm: (f?.anonimizadoEm as string | null) ?? null,
        retencaoBloqueadaEm: (f?.retencaoBloqueadaEm as string | null) ?? null,
        processosAbertos: r.processosAbertos,
        contratado: r.contratado,
        temAdmissao: withAdmission.has(r.id),
        ultimaAtividadeEm: r.ultimaAtividadeEm,
        ultimaCandidaturaEm: r.ultimaCandidaturaEm,
        createdAt: r.createdAt,
      },
      now,
      months
    )
    // Só interessa listar: elegíveis e bloqueados por motivo jurídico.
    if (!st.eligible && st.reason !== 'BLOQUEIO_JURIDICO') continue
    out.push({
      id: r.id,
      nomeCompleto: r.nomeCompleto,
      email: r.email,
      cargoDesejado: r.cargoDesejado,
      lastActivityAt: st.lastActivityAt.toISOString(),
      dueAt: st.dueAt.toISOString(),
      eligible: st.eligible,
      reason: st.reason,
      retencaoBloqueioMotivo: (f?.retencaoBloqueioMotivo as string | null) ?? null,
    })
  }
  return out
}

export type AnonymizeOutcome =
  | { ok: true }
  | { ok: false; code: 'NAO_ELEGIVEL' | 'FALHA_ARQUIVOS' | 'FALHA_BANCO'; message: string }

async function removeFiles(admin: SupabaseClient, bucket: string, paths: string[]): Promise<boolean> {
  if (paths.length === 0) return true
  const { error } = await admin.storage.from(bucket).remove(paths)
  return !error
}

/**
 * Anonimiza UM talento e todas as candidaturas dele. `force` ignora o prazo (pedido
 * do titular), mas nunca ignora processo aberto, contratação nem bloqueio jurídico.
 */
export async function anonymizeTalent(
  admin: SupabaseClient,
  talentoId: string,
  actor: RetentionActor,
  opts: { months: number; force?: boolean; reason: 'RETENCAO' | 'PEDIDO_TITULAR' }
): Promise<AnonymizeOutcome> {
  const now = new Date()
  const [{ data: crm }, { data: t }, { data: apps }] = await Promise.all([
    admin
      .from('talentos_crm')
      .select('processosAbertos, contratado, ultimaAtividadeEm, ultimaCandidaturaEm, createdAt')
      .eq('id', talentoId)
      .maybeSingle(),
    admin
      .from('talentos')
      .select('id, curriculoUrl, anonimizadoEm, retencaoBloqueadaEm')
      .eq('id', talentoId)
      .maybeSingle(),
    admin.from('applications').select('id, resumeUrl').eq('talentoId', talentoId),
  ])
  if (!t || !crm) return { ok: false, code: 'NAO_ELEGIVEL', message: 'Talento não encontrado.' }
  const applications = (apps ?? []) as Array<{ id: string; resumeUrl: string | null }>
  const appIds = applications.map((a) => a.id)

  let temAdmissao = false
  if (appIds.length > 0) {
    const { count, error: admErr } = await admin
      .from('admissions')
      .select('id', { count: 'exact', head: true })
      .in('sourceApplicationId', appIds)
    if (admErr) return { ok: false, code: 'FALHA_BANCO', message: admErr.message }
    temAdmissao = (count ?? 0) > 0
  }

  const status = retentionStatus(
    {
      anonimizadoEm: t.anonimizadoEm as string | null,
      retencaoBloqueadaEm: t.retencaoBloqueadaEm as string | null,
      processosAbertos: crm.processosAbertos as number,
      contratado: crm.contratado as boolean,
      temAdmissao,
      ultimaAtividadeEm: crm.ultimaAtividadeEm as string | null,
      ultimaCandidaturaEm: crm.ultimaCandidaturaEm as string | null,
      createdAt: crm.createdAt as string,
    },
    now,
    opts.months
  )
  const blocked = !status.eligible && !(opts.force && status.reason === 'DENTRO_DO_PRAZO')
  if (blocked) return { ok: false, code: 'NAO_ELEGIVEL', message: 'Este talento não pode ser anonimizado agora.' }

  // 1) Arquivos (currículos e anexos de avaliação). Falhou ⇒ nada muda no banco.
  const { data: assessments } = appIds.length
    ? await admin.from('application_assessments').select('attachmentUrl').in('applicationId', appIds)
    : { data: [] as Array<{ attachmentUrl: string | null }> }
  const resumePaths = [
    t.curriculoUrl as string | null,
    ...applications.map((a) => a.resumeUrl),
  ].filter((p): p is string => Boolean(p))
  const attachmentPaths = ((assessments ?? []) as Array<{ attachmentUrl: string | null }>)
    .map((a) => a.attachmentUrl)
    .filter((p): p is string => Boolean(p))
  const filesOk =
    (await removeFiles(admin, RESUMES_BUCKET, [...new Set(resumePaths)])) &&
    (await removeFiles(admin, ASSESSMENT_BUCKET, [...new Set(attachmentPaths)]))
  if (!filesOk) return { ok: false, code: 'FALHA_ARQUIVOS', message: 'Não foi possível apagar os arquivos. Tente novamente.' }

  // 2) Dados. Sem transação multi-tabela via supabase-js: cada passo é idempotente,
  //    e o talento só ganha `anonimizadoEm` por último (se algo falhar, reexecuta).
  const stamp = now.toISOString()
  const steps: Array<PromiseLike<{ error: { message: string } | null }>> = []
  if (appIds.length > 0) {
    steps.push(
      admin
        .from('applications')
        .update({
          fullName: ANON_NAME,
          email: anonymizedEmail(talentoId),
          phone: '',
          cpf: null,
          resumeUrl: null,
          resumeName: null,
          notes: null,
          country: null,
          candidateCity: null,
          candidateState: null,
          cv_profile: null,
          salaryExpectation: null,
          anonimizadoEm: stamp,
        })
        .in('id', appIds),
      admin.from('application_notes').delete().in('applicationId', appIds),
      admin.from('application_assessments').delete().in('applicationId', appIds),
      admin.from('assessment_sessions').update({ answers: {}, scoreBreakdown: null }).in('applicationId', appIds),
      admin
        .from('application_interviews')
        .update({ notes: null, location: null, interviewerName: null, cancelReason: null })
        .in('applicationId', appIds)
    )
  }
  steps.push(
    admin.from('talento_notes').delete().eq('talentoId', talentoId),
    admin.from('talento_tag_links').delete().eq('talentoId', talentoId)
  )
  for (const r of await Promise.all(steps)) {
    if (r.error) return { ok: false, code: 'FALHA_BANCO', message: r.error.message }
  }

  const { error } = await admin
    .from('talentos')
    .update({
      nomeCompleto: ANON_NAME,
      email: anonymizedEmail(talentoId),
      cpf: null,
      telefone: null,
      cidade: null,
      estado: null,
      pretensaoSalarial: null,
      linkedinUrl: null,
      curriculoUrl: null,
      curriculoNome: null,
      resumoProfissional: null,
      favorito: false,
      statusBanco: 'ARQUIVADO',
      anonimizadoEm: stamp,
    })
    .eq('id', talentoId)
  if (error) return { ok: false, code: 'FALHA_BANCO', message: error.message }

  // Log sem dados pessoais (só id e motivo).
  await admin.from('talento_audit_log').insert({
    talentoId,
    userId: actor.id,
    acao: 'ANONIMIZOU',
    entidade: 'talentos',
    entidadeId: talentoId,
    descricao: `Dados anonimizados (${opts.reason === 'RETENCAO' ? 'prazo de retenção' : 'pedido do titular'}) por ${actor.name}`,
    metadata: { reason: opts.reason, months: opts.months, arquivosApagados: resumePaths.length + attachmentPaths.length },
  })
  return { ok: true }
}

export async function setRetentionHold(
  admin: SupabaseClient,
  talentoId: string,
  actor: RetentionActor,
  hold: { motivo: string } | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await admin
    .from('talentos')
    .update(
      hold
        ? { retencaoBloqueadaEm: new Date().toISOString(), retencaoBloqueioMotivo: hold.motivo.slice(0, 500), retencaoBloqueadaPorNome: actor.name }
        : { retencaoBloqueadaEm: null, retencaoBloqueioMotivo: null, retencaoBloqueadaPorNome: null }
    )
    .eq('id', talentoId)
    .is('anonimizadoEm', null)
  if (error) return { ok: false, message: error.message }
  await admin.from('talento_audit_log').insert({
    talentoId,
    userId: actor.id,
    acao: hold ? 'BLOQUEOU_ANONIMIZACAO' : 'LIBEROU_ANONIMIZACAO',
    entidade: 'talentos',
    entidadeId: talentoId,
    descricao: hold ? `Anonimização bloqueada por ${actor.name}: ${hold.motivo.slice(0, 200)}` : `Bloqueio removido por ${actor.name}`,
  })
  return { ok: true }
}

/** Dados do titular (portabilidade, art. 18 LGPD): tudo que o sistema guarda sobre a pessoa. */
export async function exportTalentData(supabase: SupabaseClient, talentoId: string) {
  const { data: talento } = await supabase.from('talentos').select('*').eq('id', talentoId).maybeSingle()
  if (!talento) return null
  const { data: apps } = await supabase.from('applications').select('*').eq('talentoId', talentoId)
  const appIds = (apps ?? []).map((a) => a.id as string)
  const byApp = async (table: string) =>
    appIds.length ? ((await supabase.from(table).select('*').in('applicationId', appIds)).data ?? []) : []
  const [notes, assessments, sessions, interviews, tagNotes] = await Promise.all([
    byApp('application_notes'),
    byApp('application_assessments'),
    byApp('assessment_sessions'),
    byApp('application_interviews'),
    supabase.from('talento_notes').select('*').eq('talentoId', talentoId).then((r) => r.data ?? []),
  ])
  return {
    geradoEm: new Date().toISOString(),
    talento,
    candidaturas: apps ?? [],
    anotacoesCandidaturas: notes,
    anotacoesBancoTalentos: tagNotes,
    avaliacoes: assessments,
    testes: sessions,
    entrevistas: interviews,
  }
}
