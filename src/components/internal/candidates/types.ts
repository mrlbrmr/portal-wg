// Modelo de candidatura consumido pelo pipeline da vaga (Kanban, lista, comparação).
// Montado no servidor (vagas/[id]/candidatos/page.tsx) só com dados que existem no banco;
// campos opcionais/nulos significam "sem dado" — a UI omite, nunca preenche com exemplo.

import type { TestStatus } from "@/lib/recruitment/candidate-presentation";

export interface PipelineCandidate {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  resumeName: string | null;
  stageId: string;
  /** Origem da candidatura (APPLICATION_SOURCE_LABELS). */
  source: string;
  createdAt: string; // ISO
  /** Posição de ordenação manual (undefined = sem ordem definida → usa aiScore). */
  sortOrder?: number;
  /** Aderência calculada por IA (0-100). undefined = ainda não analisado. */
  aiScore?: number;
  /** Status da leitura do CV por IA (PENDING | SUCCESS | FAILED | MANUAL_REVIEW). */
  cvExtractionStatus?: string;
  /** Concluiu alguma sessão de Big Five (independe da etapa atual). */
  bigFiveDone?: boolean;
  /** Situação do teste — só preenchido quando a etapa atual é de teste. */
  testStatus?: TestStatus;
  /** Localização informada na candidatura. */
  city: string | null;
  state: string | null;
  /** Perfil extraído do currículo por IA (cv_profile). */
  lastPosition: string | null;
  experienceYears: number | null;
  education: string | null;
  skills: string[];
  /** Há anotações internas do RH. */
  hasNotes: boolean;
  /** Avaliações registradas por pessoas (entrevistas, testes) — sem contar a análise de IA. */
  assessmentCount: number;
  /** Entrada na etapa atual (application_stage_history). null = histórico não confirma. */
  enteredStageAt: string | null;
  /** Próxima entrevista registrada com data de hoje em diante. */
  nextInterviewAt: string | null;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  kind?: string;
  hideFromBoard?: boolean;
  templateId?: string | null;
  templateName?: string | null;
  templateKind?: string | null;
}

export type CandidateSortKey =
  | "default"
  | "recent"
  | "oldest"
  | "nameAZ"
  | "nameZA"
  | "scoreDesc"
  | "scoreAsc"
  | "stageLongest"
  | "stageShortest";

export const SORT_OPTIONS: Array<{ value: CandidateSortKey; label: string }> = [
  { value: "default", label: "Ordem do funil" },
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigas" },
  { value: "scoreDesc", label: "Maior aderência" },
  { value: "scoreAsc", label: "Menor aderência" },
  { value: "stageLongest", label: "Mais tempo na etapa" },
  { value: "stageShortest", label: "Menos tempo na etapa" },
  { value: "nameAZ", label: "Nome A→Z" },
  { value: "nameZA", label: "Nome Z→A" },
];

export type MatchFilter = "high" | "mid" | "low" | "none";
export type SignalFilter = "attention" | "notes" | "noResume";

export interface CandidateFilters {
  stages: string[];
  sources: string[];
  match: MatchFilter | "";
  signals: SignalFilter[];
}

export const EMPTY_FILTERS: CandidateFilters = { stages: [], sources: [], match: "", signals: [] };

export const MATCH_FILTER_LABELS: Record<MatchFilter, string> = {
  high: "80% ou mais",
  mid: "De 60% a 79%",
  low: "Abaixo de 60%",
  none: "Sem análise",
};

export const SIGNAL_FILTER_LABELS: Record<SignalFilter, string> = {
  attention: "Precisa de atenção",
  notes: "Com anotações",
  noResume: "Sem currículo",
};

/** Máximo de candidatos lado a lado na comparação. */
export const MAX_COMPARE = 4;

/**
 * Cópia otimista após mudar de etapa (antes do servidor confirmar): o candidato acabou de
 * entrar na etapa, e o status de teste da etapa anterior deixa de valer.
 */
export function withStage(c: PipelineCandidate, stageId: string): PipelineCandidate {
  if (c.stageId === stageId) return c;
  return { ...c, stageId, enteredStageAt: new Date().toISOString(), testStatus: undefined };
}
