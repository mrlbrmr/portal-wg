import type { JobStatus, Modality, ContractType } from "@/types/domain";

/**
 * Forma leve e serializável de uma vaga para as visões do painel
 * (lista, Kanban, cards). Datas em ISO string para cruzar o limite
 * server → client. Enriquecida com contagens derivadas de candidaturas.
 */
export interface JobRow {
  id: string;
  title: string;
  city: string | null;
  state: string | null;
  isTalentPool: boolean;
  modality: Modality;
  contractType: ContractType;
  department: string | null;
  responsible: string | null;
  status: JobStatus;
  slug: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastActivityAt: string; // ISO — max(updatedAt da vaga, updatedAt das candidaturas)
  candidateCount: number;
  /** Candidaturas ainda na etapa "Novo" (aguardando triagem). */
  newCount: number;
  /** Primeira vez em que a vaga ficou aberta (job_status_history); fallback createdAt. */
  openedAt: string; // ISO
  /** Última mudança de status — usada como data de encerramento em vagas encerradas. */
  statusChangedAt: string; // ISO
  closingDate: string | null; // ISO — fim das inscrições, se definido
}

/** Estado dos filtros combináveis da tela de vagas. "" = sem filtro. */
export interface JobFilters {
  status: string;
  city: string;
  department: string;
  modality: string;
  contractType: string;
  responsible: string;
}

export const EMPTY_JOB_FILTERS: JobFilters = {
  status: "",
  city: "",
  department: "",
  modality: "",
  contractType: "",
  responsible: "",
};
