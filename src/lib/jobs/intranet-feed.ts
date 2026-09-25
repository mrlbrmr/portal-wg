// Vagas para a Intranet WG Conecta (Vagas Internas) — módulo PURO.
//
// A Intranet não tem cadastro próprio de vagas: ela lê GET /api/intranet/jobs, que usa
// estas funções para montar a resposta. Aqui fica o CONTRATO da integração — só dados
// que podem aparecer para qualquer colaborador. Nada de candidatos, salário interno,
// recrutador, gestor solicitante ou escopo aprovado.

import { CONTRACT_TYPE_LABELS, MODALITY_LABELS, PUBLIC_JOB_STATUSES } from "@/lib/utils";

/** Colunas lidas de `jobs` para a Intranet. Nunca use `select("*")` aqui. */
export const INTRANET_JOB_COLUMNS =
  "id, code, title, slug, department, company, city, state, modality, contractType, workSchedule, description, openPositions, closingDate, createdAt";

export const INTRANET_SUMMARY_MAX = 220;

export interface IntranetJobRow {
  id: string;
  code: string | null;
  title: string;
  slug: string | null;
  department: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  modality: string;
  contractType: string;
  workSchedule: string | null;
  description: string | null;
  openPositions: number | null;
  closingDate: string | null;
  createdAt: string;
}

/** O que a Intranet recebe por vaga. Modalidade e contrato já vêm como rótulo. */
export interface IntranetJob {
  id: string;
  code: string | null;
  title: string;
  department: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  modality: string;
  contractType: string;
  workSchedule: string | null;
  summary: string | null;
  openPositions: number | null;
  /** Primeira vez que a vaga ficou aberta (job_status_history); sem histórico, a criação. */
  publishedAt: string;
  closingDate: string | null;
  /** Página oficial da vaga no portal, onde o colaborador se candidata. */
  url: string;
}

export interface IntranetJobsResponse {
  generatedAt: string;
  count: number;
  jobs: IntranetJob[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function toText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resumo curto em texto puro: o primeiro parágrafo da descrição (as vagas começam com
 * um título de seção, que não serve de resumo), cortado em palavra inteira.
 */
export function summaryFromHtml(html: string | null | undefined, max = INTRANET_SUMMARY_MAX): string | null {
  if (!html) return null;
  const firstParagraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1];
  const text = toText(firstParagraph ?? html);
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

/** Data da 1ª transição de cada vaga para um status aberto. */
export function firstOpenedAtByJob(
  history: ReadonlyArray<{ jobId: string; status: string; changedAt: string }>
): Map<string, string> {
  const open = new Set<string>(PUBLIC_JOB_STATUSES);
  const out = new Map<string, string>();
  for (const h of history) {
    if (!open.has(h.status)) continue;
    const prev = out.get(h.jobId);
    if (!prev || new Date(h.changedAt) < new Date(prev)) out.set(h.jobId, h.changedAt);
  }
  return out;
}

export function toIntranetJob(row: IntranetJobRow, openedAt: string | undefined, baseUrl: string): IntranetJob {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    department: row.department,
    company: row.company,
    city: row.city,
    state: row.state,
    modality: MODALITY_LABELS[row.modality] ?? row.modality,
    contractType: CONTRACT_TYPE_LABELS[row.contractType] ?? row.contractType,
    workSchedule: row.workSchedule,
    summary: summaryFromHtml(row.description),
    openPositions: row.openPositions,
    publishedAt: new Date(openedAt ?? row.createdAt).toISOString(),
    closingDate: row.closingDate ? new Date(row.closingDate).toISOString() : null,
    url: `${baseUrl}/vagas/${row.slug ?? row.id}`,
  };
}

/** Mais recente primeiro (pela publicação). */
export function sortByPublishedDesc(jobs: IntranetJob[]): IntranetJob[] {
  return [...jobs].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
