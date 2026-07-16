import type { JobStatus, Modality } from "@prisma/client";

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
  department: string | null;
  responsible: string | null;
  status: JobStatus;
  slug: string | null;
  createdAt: string; // ISO
  candidateCount: number;
}
