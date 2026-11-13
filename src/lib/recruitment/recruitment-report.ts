// Relatório de recrutamento (/recrutamento/relatorios). Puro e testado.
//
// Regras do projeto que valem aqui:
// • a vaga contínua (banco de talentos) não entra no funil nem nas taxas (job-metrics.ts);
// • "contratado" = chegou à etapa WON ou tem admissão ligada (talentos_crm, origens);
// • nunca mostrar indicador sem base real: percentuais e medianas só a partir das bases
//   mínimas abaixo — sem base, a tela mostra o número absoluto e diz "base pequena".
// Tempo por etapa fica no WG Jornada (stageVisits); aqui não se repete.

import { periodWindow, type ReportPeriod } from "../admissao/reports";

/** Candidaturas no período para mostrar percentual do funil. */
export const MIN_BASE_RATE = 20;
/** Candidaturas de uma origem para mostrar a taxa de contratação dela. */
export const MIN_BASE_SOURCE_RATE = 10;
/** Posições preenchidas para mostrar a mediana de dias até preencher. */
export const MIN_BASE_TIME = 3;

/** Etapa de entrada do funil (sistema). */
const ENTRY_STAGE_ID = "NEW";
const SCREENING_STAGE_ID = "SCREENING";

export interface ReportInput {
  jobs: Array<{ id: string; title: string; isTalentPool: boolean }>;
  stages: Array<{ id: string; kind: string }>;
  applications: Array<{ id: string; jobId: string; source: string | null; createdAt: string; stageId: string | null }>;
  /** Etapas por onde cada candidatura passou (application_stage_history). */
  history: Array<{ applicationId: string; stageId: string | null }>;
  /** Candidaturas com admissão ligada (não excluída). */
  hiredApplicationIds: string[];
  positions: Array<{ id: string; jobId: string; status: string; filledAt: string | null }>;
  /** Abertura de cada vaga (1ª passagem para status aberto; sem histórico, a criação). */
  jobOpenedAt: Record<string, string>;
}

export type FunnelKey = "received" | "advanced" | "evaluated" | "hired";

export const FUNNEL_LABELS: Record<FunnelKey, { label: string; hint: string }> = {
  received: { label: "Candidaturas recebidas", hint: "Todas as candidaturas do período (sem o banco de talentos)." },
  advanced: { label: "Avançaram da entrada", hint: "Saíram de “Novas candidaturas” para alguma etapa do processo." },
  evaluated: { label: "Chegaram a teste ou entrevista", hint: "Passaram por alguma etapa além de Novas e Triagem." },
  hired: { label: "Contratadas", hint: "Chegaram à etapa de aprovado/contratado ou têm admissão ligada." },
};

export interface RecruitmentReport {
  received: number;
  talentPoolReceived: number;
  /** Posições preenchidas no período. */
  hires: number;
  /** Dias da abertura da vaga até a posição ser preenchida (mediana); null = base pequena. */
  medianDaysToFill: number | null;
  funnel: Array<{ key: FunnelKey; count: number; pct: number | null }>;
  bySource: Array<{ source: string; received: number; hired: number; rate: number | null }>;
  byJob: Array<{ jobId: string; title: string; received: number; hired: number; filled: number; medianDaysToFill: number | null }>;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const DAY = 86_400_000;

export function buildRecruitmentReport(input: ReportInput, period: ReportPeriod, now: Date): RecruitmentReport {
  const { from } = periodWindow(period, now);
  const inWindow = (iso: string | null) => !!iso && (!from || new Date(iso).getTime() >= from.getTime());

  const poolJobs = new Set(input.jobs.filter((j) => j.isTalentPool).map((j) => j.id));
  const kindById = new Map(input.stages.map((s) => [s.id, s.kind]));
  const hiredIds = new Set(input.hiredApplicationIds);

  const visited = new Map<string, Set<string>>();
  for (const h of input.history) {
    if (!h.stageId) continue;
    if (!visited.has(h.applicationId)) visited.set(h.applicationId, new Set());
    visited.get(h.applicationId)!.add(h.stageId);
  }

  const windowApps = input.applications.filter((a) => inWindow(a.createdAt));
  const apps = windowApps.filter((a) => !poolJobs.has(a.jobId));

  const classify = (a: (typeof apps)[number]) => {
    const seen = new Set(visited.get(a.id) ?? []);
    if (a.stageId) seen.add(a.stageId);
    const kinds = [...seen].map((id) => ({ id, kind: kindById.get(id) }));
    const hired = hiredIds.has(a.id) || kinds.some((s) => s.kind === "WON");
    const evaluated =
      hired ||
      kinds.some(
        (s) =>
          s.kind === "TEST" ||
          s.kind === "ADMISSION" ||
          (s.kind === "OPEN" && s.id !== ENTRY_STAGE_ID && s.id !== SCREENING_STAGE_ID)
      );
    const advanced = evaluated || kinds.some((s) => s.id !== ENTRY_STAGE_ID && s.kind !== "LOST");
    return { advanced, evaluated, hired };
  };
  const classes = new Map(apps.map((a) => [a.id, classify(a)]));

  const received = apps.length;
  const pct = (n: number) => (received >= MIN_BASE_RATE ? Math.round((n / received) * 100) : null);
  const count = (k: "advanced" | "evaluated" | "hired") => apps.filter((a) => classes.get(a.id)![k]).length;
  const funnel: RecruitmentReport["funnel"] = [
    { key: "received", count: received, pct: received >= MIN_BASE_RATE ? 100 : null },
    { key: "advanced", count: count("advanced"), pct: pct(count("advanced")) },
    { key: "evaluated", count: count("evaluated"), pct: pct(count("evaluated")) },
    { key: "hired", count: count("hired"), pct: pct(count("hired")) },
  ];

  const bySourceMap = new Map<string, { received: number; hired: number }>();
  for (const a of apps) {
    const key = a.source ?? "OTHER";
    const row = bySourceMap.get(key) ?? { received: 0, hired: 0 };
    row.received += 1;
    if (classes.get(a.id)!.hired) row.hired += 1;
    bySourceMap.set(key, row);
  }
  const bySource = [...bySourceMap.entries()]
    .map(([source, r]) => ({
      source,
      received: r.received,
      hired: r.hired,
      rate: r.received >= MIN_BASE_SOURCE_RATE ? Math.round((r.hired / r.received) * 100) : null,
    }))
    .sort((a, b) => b.received - a.received || b.hired - a.hired);

  const filledInWindow = input.positions.filter(
    (p) => p.status === "FILLED" && !poolJobs.has(p.jobId) && inWindow(p.filledAt)
  );
  const daysToFill = (p: (typeof filledInWindow)[number]) => {
    const opened = input.jobOpenedAt[p.jobId];
    if (!opened || !p.filledAt) return null;
    return Math.max(0, Math.round((new Date(p.filledAt).getTime() - new Date(opened).getTime()) / DAY));
  };
  const medianFor = (list: typeof filledInWindow) => {
    const days = list.map(daysToFill).filter((d): d is number => d !== null);
    return days.length >= MIN_BASE_TIME ? median(days) : null;
  };

  const byJob = input.jobs
    .filter((j) => !j.isTalentPool)
    .map((j) => {
      const jobApps = apps.filter((a) => a.jobId === j.id);
      const jobFilled = filledInWindow.filter((p) => p.jobId === j.id);
      return {
        jobId: j.id,
        title: j.title,
        received: jobApps.length,
        hired: jobApps.filter((a) => classes.get(a.id)!.hired).length,
        filled: jobFilled.length,
        medianDaysToFill: medianFor(jobFilled),
      };
    })
    .filter((r) => r.received > 0 || r.filled > 0)
    .sort((a, b) => b.received - a.received || b.filled - a.filled);

  return {
    received,
    talentPoolReceived: windowApps.length - apps.length,
    hires: filledInWindow.length,
    medianDaysToFill: medianFor(filledInWindow),
    funnel,
    bySource,
    byJob,
  };
}
