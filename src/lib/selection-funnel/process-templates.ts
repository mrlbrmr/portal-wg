// Modelos de processo (pipeline templates) — regras PURAS.
//
// O catálogo de etapas (`application_stages`) continua único: guarda nome, cor, tipo,
// teste vinculado e automações. Um MODELO é uma lista ORDENADA de etapas do catálogo;
// a VAGA guarda a sua própria cópia ordenada (`job_stage_config`). Aplicar um modelo à
// vaga é COPIAR — mudar o modelo depois não altera vagas antigas (`jobs.processTemplateId`
// é só procedência).
//
// Vaga sem linhas em `job_stage_config` segue o modelo PADRÃO (ou, sem modelo padrão,
// todo o catálogo ativo — comportamento legado).

import { ENTRY_STAGE_ID } from "./automations";

export interface CatalogStage {
  id: string;
  name: string;
  sortOrder?: number | null;
  active?: boolean | null;
}

export interface OrderedStageRef {
  stageId: string;
  sortOrder?: number | null;
}

export type StageSource = "JOB" | "TEMPLATE" | "CATALOG";

export interface ResolvedStages<T extends CatalogStage> {
  stages: T[];
  /** De onde veio a lista: ajuste da própria vaga, modelo padrão ou catálogo inteiro. */
  source: StageSource;
}

function byCatalogOrder<T extends CatalogStage>(a: T, b: T): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "pt-BR");
}

function applyOrder<T extends CatalogStage>(catalog: T[], refs: OrderedStageRef[]): T[] {
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const ordered = refs
    .map((r, index) => ({ ...r, index }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.index - b.index);
  const out: T[] = [];
  for (const r of ordered) {
    const s = byId.get(r.stageId);
    if (!s || s.active === false || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

/**
 * Etapas efetivas de uma vaga, na ordem dela:
 *  1. ajuste da própria vaga (`job_stage_config`), se houver;
 *  2. senão, o modelo padrão;
 *  3. senão, todo o catálogo ativo na ordem do catálogo.
 * Etapa desativada nunca aparece.
 */
export function resolveJobStages<T extends CatalogStage>(
  catalog: T[],
  jobConfig: OrderedStageRef[] | null | undefined,
  defaultTemplate: OrderedStageRef[] | null | undefined
): ResolvedStages<T> {
  const active = catalog.filter((s) => s.active !== false);
  if (jobConfig && jobConfig.length > 0) {
    const stages = applyOrder(active, jobConfig);
    if (stages.length > 0) return { stages, source: "JOB" };
  }
  if (defaultTemplate && defaultTemplate.length > 0) {
    const stages = applyOrder(active, defaultTemplate);
    if (stages.length > 0) return { stages, source: "TEMPLATE" };
  }
  return { stages: [...active].sort(byCatalogOrder), source: "CATALOG" };
}

/** Converte linhas `{ stageId, sortOrder }` (ou só ids na ordem dada) em referências ordenadas. */
export function refsFromIds(ids: string[]): OrderedStageRef[] {
  return ids.map((stageId, i) => ({ stageId, sortOrder: (i + 1) * 10 }));
}

export const MIN_STAGES_MESSAGE = "O processo precisa de ao menos duas etapas.";
export const ENTRY_REQUIRED_MESSAGE =
  "A etapa de entrada (Novas candidaturas) é obrigatória: toda nova candidatura começa nela.";

/**
 * Valida uma seleção de etapas para modelo ou vaga. Devolve a mensagem de erro, ou null.
 * Regras: sem repetição, só etapas ativas do catálogo, etapa de entrada presente, ≥ 2 etapas.
 */
export function validateStageSelection(ids: string[], catalog: CatalogStage[]): string | null {
  if (new Set(ids).size !== ids.length) return "Há etapas repetidas na lista.";
  const byId = new Map(catalog.map((s) => [s.id, s]));
  for (const id of ids) {
    const s = byId.get(id);
    if (!s) return "Uma das etapas não existe mais. Recarregue a página e tente de novo.";
    if (s.active === false) return `A etapa "${s.name}" está desativada.`;
  }
  if (!ids.includes(ENTRY_STAGE_ID)) return ENTRY_REQUIRED_MESSAGE;
  if (ids.length < 2) return MIN_STAGES_MESSAGE;
  return null;
}

export interface RemovedStage {
  stageId: string;
  name: string;
  /** Candidatos da vaga que estão nesta etapa agora. */
  candidates: number;
}

/** Etapas que saem do processo e ainda têm candidatos — esses precisam ser movidos antes. */
export function removedWithCandidates(
  currentIds: string[],
  nextIds: string[],
  counts: Record<string, number>,
  catalog: CatalogStage[]
): RemovedStage[] {
  const next = new Set(nextIds);
  const names = new Map(catalog.map((s) => [s.id, s.name]));
  return currentIds
    .filter((id) => !next.has(id) && (counts[id] ?? 0) > 0)
    .map((id) => ({ stageId: id, name: names.get(id) ?? "etapa", candidates: counts[id] ?? 0 }));
}

/**
 * Cada etapa removida com candidatos precisa de um destino que continue no processo.
 * Devolve a mensagem de erro, ou null quando está tudo resolvido.
 */
export function validateMoves(
  removed: RemovedStage[],
  moves: Record<string, string> | null | undefined,
  nextIds: string[]
): string | null {
  const next = new Set(nextIds);
  for (const r of removed) {
    const to = moves?.[r.stageId];
    if (!to) return `Escolha para onde mover os ${r.candidates} candidato(s) de "${r.name}".`;
    if (!next.has(to)) return `O destino de "${r.name}" precisa continuar no processo.`;
  }
  return null;
}

/** Duas listas têm as mesmas etapas, na mesma ordem? */
export function sameStageList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export type ProcessKind = "TEMPLATE" | "ADJUSTED" | "DEFAULT" | "CUSTOM";

/**
 * Rótulo do estado do processo da vaga, para a UI:
 *  • DEFAULT  — sem ajuste, segue o modelo padrão;
 *  • TEMPLATE — copiado de um modelo e ainda igual a ele;
 *  • ADJUSTED — veio de um modelo, mas a vaga foi ajustada;
 *  • CUSTOM   — montado só para a vaga (sem modelo de origem).
 */
export function processKind(input: {
  source: StageSource;
  jobIds: string[];
  templateIds: string[] | null;
}): ProcessKind {
  if (input.source !== "JOB") return "DEFAULT";
  if (!input.templateIds) return "CUSTOM";
  return sameStageList(input.jobIds, input.templateIds) ? "TEMPLATE" : "ADJUSTED";
}
