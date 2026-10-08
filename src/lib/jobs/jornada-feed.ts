// Sincronização com o WG Jornada (app local do G&G) — módulo PURO.
//
// O WG Jornada roda só no computador do G&G e lê GET /api/jornada/sync (servidor a
// servidor, `Authorization: Bearer JORNADA_API_TOKEN`). Aqui fica o CONTRATO e as regras:
//
//   • vagas  — código VAG, cargo, local, gestor, motivo, histórico de status e posições;
//   • funil  — só QUANTIDADES por etapa (quem chegou até Triagem, Entrevista G&G, Entrevista
//              Gestor e Admissão/Contratado) e a origem das candidaturas. Nada de dado pessoal
//              de quem não foi contratado (LGPD: o Jornada não precisa disso);
//   • contratados — as admissões ligadas às vagas (nome, CPF, início, filial, cargo, gestor),
//              que o Jornada usa para casar com o período de experiência.
//
// "Chegou até a etapa X" = a etapa mais avançada que a candidatura já ocupou (atual ou no
// histórico), pela ordem do funil. Reprovar ou pausar NÃO apaga o caminho percorrido.
// Etapas LOST (Cancelada/Reprovado) e ocultas do quadro (Pausada) não contam como avanço.

import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import { JOB_REQUEST_REASON_LABELS } from "@/lib/job-requests/constants";
import { normalizeText } from "@/lib/utils";

export const JORNADA_FEED_VERSION = 1;

/** Colunas lidas de `jobs`. Nunca use `select("*")` aqui. */
export const JORNADA_JOB_COLUMNS =
  'id, code, title, department, company, city, state, status, "hiringManager", responsible, "openingReason", "contractType", "workSchedule", salary, "isTalentPool", "createdAt", "updatedAt"';

export const JORNADA_ADMISSION_COLUMNS =
  'id, "fullName", cpf, "birthDate", "startDate", salary, shift, "managerName", "sourceApplicationId", "sourceJobId", "createdAt", "deletedAt", branch:admission_branches(name), company:admission_companies(name), position:admission_positions(name), stage:admission_stages(name, "isFinal")';

// ─── Linhas do banco ─────────────────────────────────────────────────────────────────
export interface JobRow {
  id: string;
  code: string | null;
  title: string;
  department: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  status: string;
  hiringManager: string | null;
  responsible: string | null;
  openingReason: string | null;
  contractType: string | null;
  workSchedule: string | null;
  salary: number | string | null;
  isTalentPool: boolean | null;
  createdAt: string;
  updatedAt: string;
}
export interface StageRow {
  id: string;
  name: string;
  sortOrder: number;
  kind: string;
  hideFromBoard?: boolean | null;
}
export interface StatusHistoryRow { jobId: string; status: string; changedAt: string }
export interface PositionRow {
  jobId: string;
  positionNumber: number;
  status: string;
  applicationId: string | null;
  admissionId: string | null;
  candidateName: string | null;
  expectedStartDate: string | null;
  filledAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}
export interface ApplicationRow { id: string; jobId: string; stageId: string | null; source: string | null; createdAt: string }
export interface StageHistoryRow { applicationId: string; stageId: string | null; changedAt: string }
type Named = { name: string | null } | null;
export interface AdmissionRow {
  id: string;
  fullName: string;
  cpf: string | null;
  birthDate: string | null;
  startDate: string | null;
  salary: number | string | null;
  shift: string | null;
  managerName: string | null;
  sourceApplicationId: string | null;
  sourceJobId: string | null;
  createdAt: string;
  deletedAt: string | null;
  branch: Named | Named[];
  company: Named | Named[];
  position: Named | Named[];
  stage: ({ name: string | null; isFinal: boolean | null } | null) | Array<{ name: string | null; isFinal: boolean | null }>;
}

// ─── O que o Jornada recebe ──────────────────────────────────────────────────────────
export type FunnelKey = "triagem" | "entrevistaRH" | "entrevistaGestor" | "aprovados";
export const FUNNEL_KEYS: FunnelKey[] = ["triagem", "entrevistaRH", "entrevistaGestor", "aprovados"];

export interface JornadaFunnel {
  inscritos: number;
  triagem: number;
  entrevistaRH: number;
  entrevistaGestor: number;
  aprovados: number;
  reprovados: number;
  contratados: number;
}
export interface JornadaJob {
  id: string;
  code: string | null;
  title: string;
  department: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  /** DRAFT | ACTIVE | PAUSED | CLOSED (cancelada) | FILLED (encerrada). Etapas legadas viram ACTIVE. */
  status: string;
  hiringManager: string | null;
  responsible: string | null;
  openingReason: string | null;
  contractType: string | null;
  workSchedule: string | null;
  salary: number | null;
  createdAt: string;
  /** 1ª vez que a vaga ficou aberta; sem histórico, a criação. */
  openedAt: string;
  /** Quando a vaga entrou no status terminal atual (CLOSED/FILLED); null se aberta. */
  closedAt: string | null;
  statusHistory: Array<{ status: string; changedAt: string }>;
  positions: Array<{
    number: number;
    status: string;
    candidateName: string | null;
    applicationId: string | null;
    admissionId: string | null;
    expectedStartDate: string | null;
    filledAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
  }>;
  funnel: JornadaFunnel;
  /** Primeira vez que ALGUÉM da vaga chegou a cada etapa (ISO) — mede o tempo por etapa. */
  firstReachedAt: Partial<Record<FunnelKey | "inscritos", string>>;
  /** Candidaturas por origem (rótulo legível → quantidade). */
  sources: Record<string, number>;
}
export interface JornadaHire {
  admissionId: string;
  applicationId: string | null;
  jobId: string | null;
  jobCode: string | null;
  positionNumber: number | null;
  fullName: string;
  cpf: string | null;
  birthDate: string | null;
  startDate: string | null;
  branch: string | null;
  company: string | null;
  position: string | null;
  managerName: string | null;
  salary: number | null;
  shift: string | null;
  admissionStage: string | null;
  admissionFinished: boolean;
  source: string | null;
  createdAt: string;
}
export interface JornadaFeed {
  version: number;
  generatedAt: string;
  since: string;
  jobs: JornadaJob[];
  hires: JornadaHire[];
}

// ─── Regras ──────────────────────────────────────────────────────────────────────────
const LEGACY_ACTIVE = new Set(["SCREENING", "INTERVIEW", "ADMISSION"]);
const OPEN_STATUSES = new Set(["ACTIVE", "SCREENING", "INTERVIEW", "ADMISSION"]);
const TERMINAL = new Set(["CLOSED", "FILLED"]);

export function canonicalStatus(status: string): string {
  return LEGACY_ACTIVE.has(status) ? "ACTIVE" : status;
}

/** Data de corte padrão: 1º de janeiro do ano corrente (UTC). */
export function defaultSince(now = new Date()): string {
  return `${now.getUTCFullYear()}-01-01`;
}

/** Aceita só AAAA-MM-DD; qualquer outra coisa cai no padrão. */
export function parseSince(raw: string | null | undefined, now = new Date()): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return raw;
  return defaultSince(now);
}

/** Vaga entra no feed se ainda não terminou (qualquer data) ou foi criada a partir do corte. */
export function jobInScope(job: Pick<JobRow, "status" | "createdAt" | "isTalentPool">, since: string): boolean {
  if (job.isTalentPool) return false;
  if (!TERMINAL.has(job.status)) return true; // aberta, pausada ou rascunho: sempre
  return job.createdAt.slice(0, 10) >= since;
}

/**
 * Âncoras do funil do Jornada nas etapas configuráveis do Portal. Usa os ids estáveis do
 * seed (SCREENING, INTERVIEW, OFFER) e, se o RH tiver recriado a etapa, o nome.
 * "aprovados" = primeira etapa ADMISSION ou WON pela ordem.
 */
export function funnelAnchors(stages: StageRow[]): Partial<Record<FunnelKey, number>> {
  const byId = new Map(stages.map((s) => [s.id, s]));
  const byName = (re: RegExp) => stages.find((s) => re.test(normalizeText(s.name)));
  const pick = (id: string, re: RegExp) => (byId.get(id) ?? byName(re))?.sortOrder;
  const won = stages
    .filter((s) => s.kind === "ADMISSION" || s.kind === "WON")
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const out: Partial<Record<FunnelKey, number>> = {};
  const t = pick("SCREENING", /triagem/);
  const r = pick("INTERVIEW", /entrevista (g&g|g & g|gg|rh|g e g)|^entrevista$/);
  const g = pick("OFFER", /entrevista (com )?gestor|proposta/);
  if (t != null) out.triagem = t;
  if (r != null) out.entrevistaRH = r;
  if (g != null) out.entrevistaGestor = g;
  if (won) out.aprovados = won.sortOrder;
  return out;
}

/** Etapa conta como avanço? (exclui reprovação/cancelamento e as ocultas, como Pausada). */
function countsAsProgress(s: StageRow | undefined): s is StageRow {
  return !!s && s.kind !== "LOST" && !s.hideFromBoard;
}

export function buildFunnel(
  jobId: string,
  apps: ApplicationRow[],
  history: StageHistoryRow[],
  positions: PositionRow[],
  stages: StageRow[]
): { funnel: JornadaFunnel; firstReachedAt: JornadaJob["firstReachedAt"]; sources: Record<string, number> } {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const anchors = funnelAnchors(stages);
  const mine = apps.filter((a) => a.jobId === jobId);
  const ids = new Set(mine.map((a) => a.id));
  const histByApp = new Map<string, StageHistoryRow[]>();
  for (const h of history) {
    if (!ids.has(h.applicationId)) continue;
    const list = histByApp.get(h.applicationId) ?? [];
    list.push(h);
    histByApp.set(h.applicationId, list);
  }
  const hiredApps = new Set(
    positions.filter((p) => p.jobId === jobId && p.status === "FILLED" && p.applicationId).map((p) => p.applicationId!)
  );

  const funnel: JornadaFunnel = {
    inscritos: mine.length, triagem: 0, entrevistaRH: 0, entrevistaGestor: 0, aprovados: 0, reprovados: 0,
    contratados: positions.filter((p) => p.jobId === jobId && p.status === "FILLED").length,
  };
  const first: JornadaJob["firstReachedAt"] = {};
  const sources: Record<string, number> = {};
  const earliest = (k: keyof JornadaJob["firstReachedAt"], at: string | null | undefined) => {
    if (!at) return;
    const prev = first[k];
    if (!prev || at < prev) first[k] = at;
  };

  for (const a of mine) {
    const label = APPLICATION_SOURCE_LABELS[a.source ?? "PORTAL"] ?? a.source ?? "Portal";
    sources[label] = (sources[label] ?? 0) + 1;
    earliest("inscritos", a.createdAt);
    const current = a.stageId ? stageById.get(a.stageId) : undefined;
    if (current?.kind === "LOST") funnel.reprovados++;

    // Etapas percorridas (histórico + atual), com a data de entrada quando conhecida.
    const passed: Array<{ order: number; at: string | null }> = [];
    for (const h of histByApp.get(a.id) ?? []) {
      const s = h.stageId ? stageById.get(h.stageId) : undefined;
      if (countsAsProgress(s)) passed.push({ order: s.sortOrder, at: h.changedAt });
    }
    if (countsAsProgress(current)) passed.push({ order: current.sortOrder, at: null });
    const maxOrder = passed.reduce((m, p) => Math.max(m, p.order), -Infinity);

    for (const k of FUNNEL_KEYS) {
      const anchor = anchors[k];
      const reached = (anchor != null && maxOrder >= anchor) || (k === "aprovados" && hiredApps.has(a.id));
      if (!reached) continue;
      funnel[k]++;
      if (anchor != null) {
        for (const p of passed) if (p.order >= anchor) earliest(k, p.at);
      }
    }
  }
  // Funil é cumulativo: quem chegou à entrevista passou pela triagem (etapa pulada no quadro).
  funnel.entrevistaGestor = Math.max(funnel.entrevistaGestor, funnel.aprovados);
  funnel.entrevistaRH = Math.max(funnel.entrevistaRH, funnel.entrevistaGestor);
  funnel.triagem = Math.max(funnel.triagem, funnel.entrevistaRH);
  return { funnel, firstReachedAt: first, sources };
}

export function statusTimeline(jobId: string, history: StatusHistoryRow[]) {
  return history
    .filter((h) => h.jobId === jobId)
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
    .map((h) => ({ status: canonicalStatus(h.status), changedAt: h.changedAt }));
}

const num = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export function toJornadaJob(
  job: JobRow,
  ctx: { statusHistory: StatusHistoryRow[]; positions: PositionRow[]; apps: ApplicationRow[]; stageHistory: StageHistoryRow[]; stages: StageRow[] }
): JornadaJob {
  const timeline = statusTimeline(job.id, ctx.statusHistory);
  const status = canonicalStatus(job.status);
  const opened = timeline.find((h) => OPEN_STATUSES.has(h.status))?.changedAt ?? job.createdAt;
  let closedAt: string | null = null;
  if (TERMINAL.has(status)) {
    const last = [...timeline].reverse().find((h) => h.status === status);
    closedAt = last?.changedAt ?? job.updatedAt;
  }
  const positions = ctx.positions
    .filter((p) => p.jobId === job.id)
    .sort((a, b) => a.positionNumber - b.positionNumber)
    .map((p) => ({
      number: p.positionNumber, status: p.status, candidateName: p.candidateName, applicationId: p.applicationId,
      admissionId: p.admissionId, expectedStartDate: p.expectedStartDate, filledAt: p.filledAt,
      cancelledAt: p.cancelledAt, cancelReason: p.cancelReason,
    }));
  const f = buildFunnel(job.id, ctx.apps, ctx.stageHistory, ctx.positions, ctx.stages);
  return {
    id: job.id, code: job.code, title: job.title, department: job.department, company: job.company,
    city: job.city, state: job.state, status, hiringManager: job.hiringManager, responsible: job.responsible,
    openingReason: job.openingReason
      ? JOB_REQUEST_REASON_LABELS[job.openingReason as keyof typeof JOB_REQUEST_REASON_LABELS] ?? job.openingReason
      : null,
    contractType: job.contractType, workSchedule: job.workSchedule, salary: num(job.salary),
    createdAt: job.createdAt, openedAt: opened, closedAt, statusHistory: timeline, positions,
    funnel: f.funnel, firstReachedAt: f.firstReachedAt, sources: f.sources,
  };
}

export function toJornadaHire(
  adm: AdmissionRow,
  ctx: { jobsById: Map<string, JobRow>; positions: PositionRow[]; appsById: Map<string, ApplicationRow> }
): JornadaHire {
  const pos = ctx.positions.find((p) => p.admissionId === adm.id && p.status === "FILLED")
    ?? ctx.positions.find((p) => p.admissionId === adm.id);
  const jobId = pos?.jobId ?? adm.sourceJobId ?? null;
  const appId = pos?.applicationId ?? adm.sourceApplicationId ?? null;
  const app = appId ? ctx.appsById.get(appId) : undefined;
  const stage = one(adm.stage);
  return {
    admissionId: adm.id,
    applicationId: appId,
    jobId,
    jobCode: jobId ? ctx.jobsById.get(jobId)?.code ?? null : null,
    positionNumber: pos?.positionNumber ?? null,
    fullName: adm.fullName,
    cpf: adm.cpf ? adm.cpf.replace(/\D/g, "") || null : null,
    birthDate: adm.birthDate,
    startDate: adm.startDate,
    branch: one(adm.branch)?.name ?? null,
    company: one(adm.company)?.name ?? null,
    position: one(adm.position)?.name ?? null,
    managerName: adm.managerName,
    salary: num(adm.salary),
    shift: adm.shift,
    admissionStage: stage?.name ?? null,
    admissionFinished: !!stage?.isFinal,
    source: app ? APPLICATION_SOURCE_LABELS[app.source ?? "PORTAL"] ?? app.source : null,
    createdAt: adm.createdAt,
  };
}

/** Monta a resposta inteira a partir das linhas já filtradas pela rota. */
export function buildJornadaFeed(input: {
  since: string;
  now?: Date;
  jobs: JobRow[];
  stages: StageRow[];
  statusHistory: StatusHistoryRow[];
  positions: PositionRow[];
  apps: ApplicationRow[];
  stageHistory: StageHistoryRow[];
  admissions: AdmissionRow[];
}): JornadaFeed {
  const jobs = input.jobs.filter((j) => jobInScope(j, input.since));
  const jobsById = new Map(jobs.map((j) => [j.id, j]));
  const appsById = new Map(input.apps.map((a) => [a.id, a]));
  const ctx = { statusHistory: input.statusHistory, positions: input.positions, apps: input.apps, stageHistory: input.stageHistory, stages: input.stages };
  const hires = input.admissions
    .filter((a) => !a.deletedAt)
    .map((a) => toJornadaHire(a, { jobsById, positions: input.positions, appsById }))
    .filter((h) => h.jobId && jobsById.has(h.jobId))
    .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  return {
    version: JORNADA_FEED_VERSION,
    generatedAt: (input.now ?? new Date()).toISOString(),
    since: input.since,
    jobs: jobs.map((j) => toJornadaJob(j, ctx)).sort((a, b) => a.openedAt.localeCompare(b.openedAt)),
    hires,
  };
}
