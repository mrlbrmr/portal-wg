// Helpers de consulta de vagas para supabase-js (PostgREST), compartilhados entre
// a homepage pública e GET /api/jobs. Substituem o `where` do Prisma.
//
// Observação: a visibilidade pública (status aberto) também é garantida por RLS,
// mas mantemos o filtro explícito de status + prazo aqui para preservar 1:1 o
// comportamento anterior (inclusive esconder vagas com closingDate vencido).
//
// O query builder do PostgREST é fluente e sem um tipo público simples de
// encadear; usamos `any` de forma contida (o runtime é correto; a tipagem forte
// fica nos dados retornados, castados para os tipos de domínio do Prisma).
import { INTRANET_VISIBILITIES, PORTAL_LISTED_VISIBILITIES, PUBLIC_JOB_STATUSES } from "@/lib/utils";

export interface JobFilterParams {
  city?: string | null;
  modality?: string | null;
  department?: string | null;
  query?: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Aplica os filtros de texto/seleção comuns (cidade/modelo/departamento/busca). */
export function applyJobFilters(q: any, f: JobFilterParams): any {
  let r = q;
  if (f.city) r = r.ilike("city", `%${f.city}%`);
  if (f.modality) r = r.eq("modality", f.modality);
  if (f.department) r = r.ilike("department", `%${f.department}%`);
  if (f.query) r = r.ilike("title", `%${f.query}%`);
  return r;
}

/** Vaga aberta (status público) e com inscrições no prazo — vale para Portal e Intranet. */
export function onlyOpenJobs(q: any): any {
  const now = new Date().toISOString();
  return q
    .in("status", PUBLIC_JOB_STATUSES as readonly string[])
    .or(`closingDate.is.null,closingDate.gte.${now}`);
}

/** Vagas que o portal LISTA: abertas, no prazo e não marcadas "Somente Intranet". */
export function onlyPublicVisible(q: any): any {
  return onlyOpenJobs(q).in("visibility", PORTAL_LISTED_VISIBILITIES as readonly string[]);
}

/** Vagas de Vagas Internas (Intranet): abertas, no prazo e não marcadas "Somente Portal". */
export function onlyIntranetVisible(q: any): any {
  return onlyOpenJobs(q).in("visibility", INTRANET_VISIBILITIES as readonly string[]);
}

/**
 * Colunas que o portal PÚBLICO pode ler. Nunca use `select("*")` no público: a vaga tem
 * dados internos (salário interno quando "não divulgar", recrutador, gestor solicitante,
 * escopo aprovado da solicitação) que não podem chegar ao navegador do candidato.
 * O salário público é `salaryRange` (derivado em src/lib/jobs/salary.ts).
 */
export const PUBLIC_JOB_COLUMNS =
  "id, code, title, slug, department, company, city, state, isTalentPool, modality, contractType, " +
  "description, responsibilities, requiredRequirements, desiredRequirements, benefits, workSchedule, " +
  "salaryRange, openings, openPositions, highlightBenefit, closingDate, status, visibility, createdAt, updatedAt";
