// Perfil do talento para o drawer (consulta rápida) e a página completa — os dois leem
// daqui, então mostram exatamente os mesmos dados.
//
// LGPD: só dados de RECRUTAMENTO. Documentos e dados admissionais ficam no módulo de
// Admissões e não aparecem no Banco de Talentos. CPF aparece mascarado.

import type { createClient } from "@/lib/supabase/server";
import { resolveAssessmentType, type AssessmentType } from "@/lib/avaliacoes/schema";
import type { TalentSituation } from "./crm";
import type { TagItem } from "./service";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface TalentApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  jobCode: string | null;
  jobStatus: string;
  jobArea: string | null;
  createdAt: string;
  source: string;
  addedBy: string | null;
  stageId: string;
  stageName: string;
  stageKind: string;
  stageColor: string | null;
  /** Etapa aberta numa vaga não encerrada — conta como "processo atual". */
  isOpen: boolean;
  resumeName: string | null;
  hasResume: boolean;
  /** O currículo desta candidatura é o mesmo arquivo do perfil (não listar duas vezes). */
  resumeIsProfileCv: boolean;
}

export interface TalentStageEvent {
  id: string;
  applicationId: string;
  stageId: string | null;
  stageName: string;
  stageKind: string | null;
  changedAt: string;
  changedBy: string | null;
}

export interface TalentSession {
  id: string;
  applicationId: string | null;
  templateId: string;
  templateName: string;
  validityMonths: number | null;
  validoAte: string | null;
  assessmentType: AssessmentType;
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
  outcome: string | null;
  score: number | null;
  invalidadoEm: string | null;
}

export interface TalentNote {
  id: string;
  autorId: string;
  autorNome: string | null;
  conteudo: string;
  createdAt: string;
  updatedAt: string;
}

export interface TalentAuditEvent {
  id: string;
  acao: string;
  descricao: string | null;
  createdAt: string;
  actorName: string | null;
}

export interface TalentProfileData {
  id: string;
  nomeCompleto: string;
  email: string;
  telefone: string | null;
  cpfMascarado: string | null;
  cidade: string | null;
  estado: string | null;
  cargoDesejado: string | null;
  areaInteresse: string | null;
  pretensaoSalarial: number | null;
  linkedinUrl: string | null;
  resumoProfissional: string | null;
  origem: string;
  origemDetalhe: string | null;
  statusBanco: string;
  situacao: TalentSituation;
  favorito: boolean;
  createdAt: string;
  ultimaAtividadeEm: string;
  consentimentoLgpdEm: string | null;
  hasCurriculo: boolean;
  curriculoNome: string | null;
  ultimoCargoCv: string | null;
  habilidadesCv: string[];
  tags: TagItem[];
  applications: TalentApplication[];
  stageHistory: TalentStageEvent[];
  sessions: TalentSession[];
  notes: TalentNote[];
  events: TalentAuditEvent[];
}

const CRM_ACTIONS = ["CRIADO", "DADOS_EDITADOS", "TAGS_ALTERADAS", "STATUS_ALTERADO", "ARQUIVADO", "RESTAURADO", "ADICIONADO_A_VAGA"];
const TERMINAL_JOB = ["CLOSED", "FILLED"];
const OPEN_KINDS = ["OPEN", "TEST", "ADMISSION"];

function maskCpf(cpf: string | null): string | null {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export async function loadTalentProfile(supabase: Supabase, id: string): Promise<TalentProfileData | null> {
  const [baseRes, crmRes, tagsRes, appsRes, notesRes, eventsRes, stagesRes] = await Promise.all([
    supabase
      .from("talentos")
      .select(
        "id, nomeCompleto, email, telefone, cpf, cidade, estado, cargoDesejado, areaInteresse, pretensaoSalarial, linkedinUrl, resumoProfissional, origem, statusBanco, favorito, createdAt, ultimaAtividadeEm, consentimentoLgpdEm, curriculoUrl, curriculoNome"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("talentos_crm").select("situacao, origemDetalhe, ultimoCargoCv").eq("id", id).maybeSingle(),
    supabase.from("talento_tag_links").select("tag:admission_tags(id, name, color)").eq("talentoId", id),
    supabase
      .from("applications")
      .select("id, jobId, createdAt, source, addedBy, stageId, resumeUrl, resumeName, cv_profile, job:jobs(title, code, status, department)")
      .eq("talentoId", id)
      .order("createdAt", { ascending: false }),
    supabase
      .from("talento_notes")
      .select("id, autorId, autorNome, conteudo, createdAt, updatedAt")
      .eq("talentoId", id)
      .order("createdAt", { ascending: false }),
    supabase
      .from("talento_audit_log")
      .select("id, acao, descricao, createdAt, metadata")
      .eq("talentoId", id)
      .in("acao", CRM_ACTIONS)
      .order("createdAt", { ascending: false })
      .limit(200),
    supabase.from("application_stages").select("id, name, kind, color"),
  ]);

  const base = baseRes.data as Record<string, unknown> | null;
  if (!base) return null;
  const crm = (crmRes.data ?? {}) as { situacao?: TalentSituation; origemDetalhe?: string | null; ultimoCargoCv?: string | null };

  const stages = new Map(
    ((stagesRes.data ?? []) as Array<{ id: string; name: string; kind: string; color: string | null }>).map((s) => [s.id, s])
  );

  type RawApp = {
    id: string;
    jobId: string;
    createdAt: string;
    source: string;
    addedBy: string | null;
    stageId: string;
    resumeUrl: string | null;
    resumeName: string | null;
    cv_profile: { skills?: unknown } | null;
    job: { title: string; code: string | null; status: string; department: string | null } | null;
  };
  const rawApps = (appsRes.data ?? []) as unknown as RawApp[];
  const applications: TalentApplication[] = rawApps.map((a) => {
    const st = stages.get(a.stageId);
    const jobStatus = a.job?.status ?? "";
    return {
      id: a.id,
      jobId: a.jobId,
      jobTitle: a.job?.title ?? "Vaga removida",
      jobCode: a.job?.code ?? null,
      jobStatus,
      jobArea: a.job?.department ?? null,
      createdAt: a.createdAt,
      source: a.source,
      addedBy: a.addedBy,
      stageId: a.stageId,
      stageName: st?.name ?? a.stageId,
      stageKind: st?.kind ?? "OPEN",
      stageColor: st?.color ?? null,
      isOpen: OPEN_KINDS.includes(st?.kind ?? "") && !TERMINAL_JOB.includes(jobStatus),
      resumeName: a.resumeName,
      hasResume: Boolean(a.resumeUrl),
      resumeIsProfileCv: Boolean(a.resumeUrl) && a.resumeUrl === base.curriculoUrl,
    };
  });

  const skills = rawApps
    .map((a) => a.cv_profile?.skills)
    .find((s): s is unknown[] => Array.isArray(s) && s.length > 0);

  const appIds = applications.map((a) => a.id);
  const [historyRes, sessByTalent, sessByApp] = await Promise.all([
    appIds.length
      ? supabase
          .from("application_stage_history")
          .select("id, applicationId, stageId, changedAt, changedBy")
          .in("applicationId", appIds)
          .order("changedAt", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from("assessment_sessions")
      .select("id, applicationId, templateId, createdAt, startedAt, submittedAt, expiresAt, validoAte, outcome, score, invalidadoEm, template:assessment_templates(name, kind, assessmentType, validityMonths)")
      .eq("talentoId", id),
    appIds.length
      ? supabase
          .from("assessment_sessions")
          .select("id, applicationId, templateId, createdAt, startedAt, submittedAt, expiresAt, validoAte, outcome, score, invalidadoEm, template:assessment_templates(name, kind, assessmentType, validityMonths)")
          .in("applicationId", appIds)
      : Promise.resolve({ data: [] }),
  ]);

  const stageHistory: TalentStageEvent[] = (
    (historyRes.data ?? []) as Array<{ id: string; applicationId: string; stageId: string | null; changedAt: string; changedBy: string | null }>
  ).map((h) => {
    const st = h.stageId ? stages.get(h.stageId) : undefined;
    return {
      id: h.id,
      applicationId: h.applicationId,
      stageId: h.stageId,
      stageName: st?.name ?? h.stageId ?? "Etapa",
      stageKind: st?.kind ?? null,
      changedAt: h.changedAt,
      changedBy: h.changedBy,
    };
  });

  type RawSession = {
    id: string;
    applicationId: string | null;
    templateId: string;
    validoAte: string | null;
    createdAt: string;
    startedAt: string | null;
    submittedAt: string | null;
    expiresAt: string | null;
    outcome: string | null;
    score: number | null;
    invalidadoEm: string | null;
    template: { name: string; kind: string; assessmentType: string | null; validityMonths: number | null } | null;
  };
  const sessionMap = new Map<string, RawSession>();
  for (const s of [...((sessByTalent.data ?? []) as unknown as RawSession[]), ...((sessByApp.data ?? []) as unknown as RawSession[])]) {
    sessionMap.set(s.id, s);
  }
  const sessions: TalentSession[] = [...sessionMap.values()]
    .map((s) => ({
      id: s.id,
      applicationId: s.applicationId,
      templateId: s.templateId,
      templateName: s.template?.name ?? "Avaliação",
      validityMonths: s.template?.validityMonths ?? null,
      validoAte: s.validoAte,
      assessmentType: resolveAssessmentType({ assessmentType: s.template?.assessmentType, kind: s.template?.kind ?? "" }),
      createdAt: s.createdAt,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt,
      expiresAt: s.expiresAt,
      outcome: s.outcome,
      score: s.score,
      invalidadoEm: s.invalidadoEm,
    }))
    .sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt));

  const tags = ((tagsRes.data ?? []) as unknown as Array<{ tag: TagItem | null }>)
    .flatMap((r) => (r.tag ? [r.tag] : []))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const events: TalentAuditEvent[] = (
    (eventsRes.data ?? []) as Array<{ id: number | string; acao: string; descricao: string | null; createdAt: string; metadata: { actorName?: string } | null }>
  ).map((e) => ({
    id: String(e.id),
    acao: e.acao,
    descricao: e.descricao,
    createdAt: e.createdAt,
    actorName: e.metadata?.actorName ?? null,
  }));

  return {
    id: base.id as string,
    nomeCompleto: base.nomeCompleto as string,
    email: base.email as string,
    telefone: (base.telefone as string | null) ?? null,
    cpfMascarado: maskCpf(base.cpf as string | null),
    cidade: (base.cidade as string | null)?.trim() || null,
    estado: (base.estado as string | null)?.trim() || null,
    cargoDesejado: (base.cargoDesejado as string | null) ?? null,
    areaInteresse: (base.areaInteresse as string | null) ?? null,
    pretensaoSalarial: base.pretensaoSalarial != null ? Number(base.pretensaoSalarial) : null,
    linkedinUrl: (base.linkedinUrl as string | null) ?? null,
    resumoProfissional: (base.resumoProfissional as string | null) ?? null,
    origem: base.origem as string,
    origemDetalhe: crm.origemDetalhe ?? null,
    statusBanco: base.statusBanco as string,
    situacao: crm.situacao ?? "DISPONIVEL",
    favorito: Boolean(base.favorito),
    createdAt: base.createdAt as string,
    ultimaAtividadeEm: base.ultimaAtividadeEm as string,
    consentimentoLgpdEm: (base.consentimentoLgpdEm as string | null) ?? null,
    hasCurriculo: Boolean(base.curriculoUrl),
    curriculoNome: (base.curriculoNome as string | null) ?? null,
    ultimoCargoCv: crm.ultimoCargoCv ?? null,
    habilidadesCv: (skills ?? []).filter((s): s is string => typeof s === "string").slice(0, 12),
    tags,
    applications,
    stageHistory,
    sessions,
    notes: (notesRes.data ?? []) as TalentNote[],
    events,
  };
}
