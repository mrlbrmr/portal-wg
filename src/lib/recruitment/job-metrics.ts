// Contagens de vagas que aparecem em mais de uma tela (Visão geral, lista de Vagas e home
// pública). Regra ÚNICA: a vaga contínua do banco de talentos (jobs."isTalentPool") NÃO é
// "vaga aberta" — é a porta de entrada do banco e aparece à parte. Puro e testado.

import { jobLifecycle } from "./job-presentation";

export interface JobMetricsInput {
  status: string;
  isTalentPool: boolean;
  /** Candidaturas ativas (sem as de etapa LOST). */
  candidateCount: number;
  /** Candidaturas na etapa de entrada, aguardando triagem. */
  newCount: number;
}

/** Vaga aberta que entra nos contadores: processo com posição, nunca a vaga contínua. */
export function isCountedOpenJob(job: Pick<JobMetricsInput, "status" | "isTalentPool">): boolean {
  return !job.isTalentPool && jobLifecycle(job.status) === "OPEN";
}

/** Vaga contínua do banco de talentos que está recebendo candidaturas. */
export function isOpenTalentPool(job: Pick<JobMetricsInput, "status" | "isTalentPool">): boolean {
  return job.isTalentPool && jobLifecycle(job.status) === "OPEN";
}

export interface JobMetrics<T> {
  /** Vagas abertas com posição (sem a vaga contínua). */
  openJobs: T[];
  /** Vagas contínuas abertas (normalmente uma). */
  talentPools: T[];
  /** Candidaturas ativas nas vagas abertas (sem a vaga contínua). */
  activeCandidates: number;
  /** Candidaturas aguardando triagem nas vagas abertas (sem a vaga contínua). */
  awaitingTriage: number;
  /** Candidaturas novas na vaga contínua — triagem à parte, sem alerta de vaga. */
  talentPoolAwaitingTriage: number;
}

export function summarizeJobs<T extends JobMetricsInput>(jobs: readonly T[]): JobMetrics<T> {
  const openJobs = jobs.filter(isCountedOpenJob);
  const talentPools = jobs.filter(isOpenTalentPool);
  const sum = (list: T[], pick: (j: T) => number) => list.reduce((acc, j) => acc + pick(j), 0);
  return {
    openJobs,
    talentPools,
    activeCandidates: sum(openJobs, (j) => j.candidateCount),
    awaitingTriage: sum(openJobs, (j) => j.newCount),
    talentPoolAwaitingTriage: sum(talentPools, (j) => j.newCount),
  };
}
