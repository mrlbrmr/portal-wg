// Listagem do Banco de Talentos — consulta a view talentos_crm com filtros, ordenação e
// paginação NO SERVIDOR (preparado para milhares de talentos). Regras puras em crm.ts.

import type { createClient } from "@/lib/supabase/server";
import {
  SORT_OPTIONS,
  presetRange,
  searchTerms,
  type DatePreset,
  type TalentFilters,
  type TalentSituation,
  type TalentSort,
} from "./crm";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const TALENT_PAGE_SIZE = 25;

export interface TalentRow {
  id: string;
  nomeCompleto: string;
  email: string;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  cargoDesejado: string | null;
  areaInteresse: string | null;
  curriculoUrl: string | null;
  favorito: boolean;
  situacao: TalentSituation;
  statusBanco: string;
  processos: number;
  processosAbertos: number;
  ultimoJobId: string | null;
  ultimoJobTitulo: string | null;
  ultimoJobArea: string | null;
  ultimaEtapaNome: string | null;
  ultimaEtapaTipo: string | null;
  ultimoCargoCv: string | null;
  ultimaCandidaturaEm: string | null;
  ultimaAtividadeEm: string;
  createdAt: string;
  tagIds: string[];
  origemDetalhe: string | null;
}

const COLUMNS =
  "id, nomeCompleto, email, telefone, cidade, estado, cargoDesejado, areaInteresse, curriculoUrl, favorito, situacao, statusBanco, processos, processosAbertos, ultimoJobId, ultimoJobTitulo, ultimoJobArea, ultimaEtapaNome, ultimaEtapaTipo, ultimoCargoCv, ultimaCandidaturaEm, ultimaAtividadeEm, createdAt, tagIds, origemDetalhe";

// O builder do supabase-js é genérico demais para tipar aqui; só usamos os filtros abaixo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;

function applyPreset(query: Query, column: string, preset: DatePreset | "", now: Date): Query {
  if (!preset) return query;
  const r = presetRange(preset, now);
  if (r.isNull) return query.is(column, null);
  if (r.gte) query = query.gte(column, r.gte);
  if (r.lt) query = query.lt(column, r.lt);
  return query;
}

/** Aplica os filtros à consulta da view. Arquivados só aparecem se pedidos no filtro. */
export function applyTalentFilters(query: Query, f: TalentFilters, now: Date = new Date()): Query {
  if (f.situacao.length > 0) query = query.in("situacao", f.situacao);
  else query = query.neq("situacao", "ARQUIVADO");

  for (const term of searchTerms(f.q)) query = query.ilike("busca", `%${term}%`);

  if (f.uf.length > 0) query = query.in("ufChave", f.uf);
  if (f.cidade.length > 0) query = query.in("cidadeChave", f.cidade);
  if (f.cargo.length > 0) query = query.in("cargoDesejado", f.cargo);
  if (f.area.length > 0) query = query.overlaps("areas", f.area);
  if (f.tag.length > 0) query = query.contains("tagIds", f.tag);
  if (f.origem.length > 0) query = query.in("origemDetalhe", f.origem);
  if (f.vaga.length > 0) query = query.overlaps("jobIds", f.vaga);
  if (f.etapa.length > 0) query = query.overlaps("etapaIds", f.etapa);
  if (f.favorito) query = query.eq("favorito", true);
  if (f.avaliacao) query = query.gt("avaliacoesConcluidas", 0);

  query = applyPreset(query, "ultimaCandidaturaEm", f.candidatura, now);
  query = applyPreset(query, "createdAt", f.entrada, now);
  query = applyPreset(query, "ultimaAtividadeEm", f.atividade, now);
  return query;
}

export interface TalentPage {
  rows: TalentRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function loadTalentPage(
  supabase: Supabase,
  input: { filters: TalentFilters; sort: TalentSort; asc: boolean; page: number; pageSize?: number }
): Promise<TalentPage> {
  const pageSize = input.pageSize ?? TALENT_PAGE_SIZE;
  const page = Math.max(1, input.page);
  const column = SORT_OPTIONS.find((o) => o.value === input.sort)?.column ?? "ultimaAtividadeEm";

  let query = supabase.from("talentos_crm").select(COLUMNS, { count: "exact" });
  query = applyTalentFilters(query, input.filters);
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order(column, { ascending: input.asc, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);

  // Página além do fim (ex.: filtro reduziu o total): o chamador volta para a última.
  if (error && error.code === "PGRST103") return { rows: [], total: count ?? 0, page, pageSize };
  if (error) throw new Error(`Falha ao carregar talentos: ${error.message}`);
  return { rows: (data ?? []) as TalentRow[], total: count ?? 0, page, pageSize };
}

/** Todos os ids que atendem aos filtros (seleção "todos os resultados" das ações em massa). */
export async function loadTalentIds(supabase: Supabase, filters: TalentFilters, limit = 1000): Promise<string[]> {
  const query = applyTalentFilters(supabase.from("talentos_crm").select("id"), filters);
  const { data, error } = await query.order("id").limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

// ─── Facetas + indicadores ─────────────────────────────────────────────────────────

export interface FacetOption {
  value: string;
  label?: string;
  count: number;
}

export interface TalentFacets {
  total: number;
  arquivados: number;
  favoritos: number;
  novosMes: number;
  situacoes: Partial<Record<TalentSituation, number>>;
  estados: FacetOption[];
  cidades: FacetOption[];
  cargos: FacetOption[];
  areas: FacetOption[];
  origens: FacetOption[];
}

const EMPTY_FACETS: TalentFacets = {
  total: 0,
  arquivados: 0,
  favoritos: 0,
  novosMes: 0,
  situacoes: {},
  estados: [],
  cidades: [],
  cargos: [],
  areas: [],
  origens: [],
};

export async function loadTalentFacets(supabase: Supabase): Promise<TalentFacets> {
  const { data, error } = await supabase.rpc("talentos_crm_facets");
  if (error || !data) {
    console.warn("[talentos] facetas", error?.message);
    return EMPTY_FACETS;
  }
  return { ...EMPTY_FACETS, ...(data as Partial<TalentFacets>) };
}
