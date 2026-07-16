import type { JobStatus, Modality, ContractType, JobPriority } from "@prisma/client";

/**
 * Forma leve e serializável de uma vaga para as visões do painel
 * (lista, Kanban, cards). Datas em ISO string para cruzar o limite
 * server → client. Enriquecida com contagens derivadas de candidaturas.
 */
export interface JobRow {
  id: string;
  title: string;
  city: string;
  state: string;
  modality: Modality;
  contractType: ContractType;
  department: string | null;
  responsible: string | null;
  status: JobStatus;
  priority: JobPriority;
  slug: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  candidateCount: number;
}

/** Estado dos filtros combináveis da tela de vagas. "" = sem filtro. */
export interface JobFilters {
  status: string;
  city: string;
  department: string;
  modality: string;
  contractType: string;
  responsible: string;
  priority: string;
}

export const EMPTY_JOB_FILTERS: JobFilters = {
  status: "",
  city: "",
  department: "",
  modality: "",
  contractType: "",
  responsible: "",
  priority: "",
};
