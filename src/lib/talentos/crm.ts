// Banco de Talentos (CRM) — regras PURAS compartilhadas por página, drawer e servidor.
// Sem I/O: filtros ↔ URL, situação do talento, origens, datas relativas. Testes: crm.test.ts.
//
// Situação do talento × status da candidatura (dimensões DIFERENTES):
//   • a candidatura tem ETAPA (Triagem, Entrevista…) — vive em applications.stageId;
//   • o talento tem SITUAÇÃO no banco — calculada pela view talentos_crm:
//       ARQUIVADO    ← statusBanco = ARQUIVADO                        (manual)
//       EM_PROCESSO  ← candidatura em etapa aberta de vaga não encerrada (calculado)
//       CONTRATADO   ← alguma candidatura em etapa do tipo WON         (calculado)
//       INDISPONIVEL ← statusBanco = INDISPONIVEL                     (manual)
//       DISPONIVEL   ← demais                                         (padrão)
//   O RH só edita o que é manual (Disponível/Indisponível e Arquivar/Restaurar); "Em
//   processo" e "Contratado" refletem o processo seletivo e nunca são escolhidos à mão.

import type { Tone } from "@/components/ui/StatusBadge";
import { normalizeText } from "@/lib/utils";

// ─── Situação ───────────────────────────────────────────────────────────────────────

export type TalentSituation = "DISPONIVEL" | "EM_PROCESSO" | "CONTRATADO" | "INDISPONIVEL" | "ARQUIVADO";

export const TALENT_SITUATIONS: TalentSituation[] = [
  "DISPONIVEL",
  "EM_PROCESSO",
  "CONTRATADO",
  "INDISPONIVEL",
  "ARQUIVADO",
];

export const SITUATION_META: Record<TalentSituation, { label: string; tone: Tone; hint: string; calculated: boolean }> = {
  DISPONIVEL: {
    label: "Disponível",
    tone: "success",
    hint: "Pode ser considerado para novas vagas.",
    calculated: false,
  },
  EM_PROCESSO: {
    label: "Em processo",
    tone: "info",
    hint: "Participa de um processo seletivo em andamento (calculado pelas candidaturas).",
    calculated: true,
  },
  CONTRATADO: {
    label: "Contratado",
    tone: "success",
    hint: "Foi aprovado em um processo seletivo (calculado pelas candidaturas).",
    calculated: true,
  },
  INDISPONIVEL: {
    label: "Indisponível",
    tone: "warning",
    hint: "Marcado pelo RH como indisponível para novas oportunidades.",
    calculated: false,
  },
  ARQUIVADO: {
    label: "Arquivado",
    tone: "neutral",
    hint: "Fora da lista padrão. O histórico é mantido e o talento pode ser restaurado.",
    calculated: false,
  },
};

export function isTalentSituation(v: unknown): v is TalentSituation {
  return typeof v === "string" && (TALENT_SITUATIONS as string[]).includes(v);
}

/** Status gravado em talentos.statusBanco que o RH pode escolher. */
export type EditableBankStatus = "ATIVO" | "INDISPONIVEL";

export const EDITABLE_STATUS_LABELS: Record<EditableBankStatus, string> = {
  ATIVO: "Disponível",
  INDISPONIVEL: "Indisponível",
};

// ─── Origem ─────────────────────────────────────────────────────────────────────────

/** Valores de talentos_crm.origemDetalhe (origem do talento ou da 1ª candidatura). */
export const ORIGIN_LABELS: Record<string, string> = {
  PORTAL: "Portal de carreiras",
  WHATSAPP: "WhatsApp",
  CATHO: "Catho",
  INDEED: "Indeed",
  INDICACAO: "Indicação",
  INTERNAL_REFERRAL: "Indicação",
  OTHER: "Outro",
  BANCO_TALENTOS: "Banco de Talentos",
  CADASTRO_MANUAL: "Cadastro manual",
  IMPORTACAO: "Importação",
  CANDIDATURA_ESPONTANEA: "Candidatura espontânea",
  VAGA_ESPECIFICA: "Candidatura em vaga",
};

export function originLabel(value: string | null | undefined): string {
  if (!value) return "Não informada";
  return ORIGIN_LABELS[value] ?? value;
}

// ─── Filtros (URL ⇄ estado) ────────────────────────────────────────────────────────

export type DatePreset = "7d" | "30d" | "90d" | "180d" | "365d" | "mes" | "sem90" | "mais365" | "nunca";

export const CANDIDATURA_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "30d", label: "Nos últimos 30 dias" },
  { value: "90d", label: "Nos últimos 90 dias" },
  { value: "365d", label: "No último ano" },
  { value: "mais365", label: "Há mais de 1 ano" },
  { value: "nunca", label: "Nunca se candidatou" },
];

export const ENTRADA_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "mes", label: "Este mês" },
  { value: "30d", label: "Nos últimos 30 dias" },
  { value: "90d", label: "Nos últimos 90 dias" },
  { value: "365d", label: "No último ano" },
];

export const ATIVIDADE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "7d", label: "Nos últimos 7 dias" },
  { value: "30d", label: "Nos últimos 30 dias" },
  { value: "90d", label: "Nos últimos 90 dias" },
  { value: "sem90", label: "Sem atividade há 90+ dias" },
];

export interface TalentFilters {
  q: string;
  situacao: TalentSituation[];
  uf: string[];
  cidade: string[];
  cargo: string[];
  area: string[];
  /** Tags: o talento precisa ter TODAS as selecionadas. */
  tag: string[];
  origem: string[];
  vaga: string[];
  etapa: string[];
  favorito: boolean;
  avaliacao: boolean;
  candidatura: DatePreset | "";
  entrada: DatePreset | "";
  atividade: DatePreset | "";
}

export const EMPTY_FILTERS: TalentFilters = {
  q: "",
  situacao: [],
  uf: [],
  cidade: [],
  cargo: [],
  area: [],
  tag: [],
  origem: [],
  vaga: [],
  etapa: [],
  favorito: false,
  avaliacao: false,
  candidatura: "",
  entrada: "",
  atividade: "",
};

const LIST_KEYS = ["situacao", "uf", "cidade", "cargo", "area", "tag", "origem", "vaga", "etapa"] as const;
const PRESET_KEYS = ["candidatura", "entrada", "atividade"] as const;
const ALL_PRESETS: DatePreset[] = ["7d", "30d", "90d", "180d", "365d", "mes", "sem90", "mais365", "nunca"];

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(sp: ParamSource, key: string): string {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? "";
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/**
 * Listas usam "|" como separador: nomes de cidade, cargo e área podem conter vírgula.
 * Valores são saneados (sem "|", até 120 caracteres, no máximo 50 por filtro).
 */
function readList(sp: ParamSource, key: string): string[] {
  return read(sp, key)
    .split("|")
    .map((s) => s.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 50);
}

function readPreset(sp: ParamSource, key: string): DatePreset | "" {
  const v = read(sp, key);
  return (ALL_PRESETS as string[]).includes(v) ? (v as DatePreset) : "";
}

export function parseTalentFilters(sp: ParamSource): TalentFilters {
  return {
    q: read(sp, "q").trim().slice(0, 120),
    situacao: readList(sp, "situacao").filter(isTalentSituation),
    uf: readList(sp, "uf").map((u) => u.toUpperCase()),
    cidade: readList(sp, "cidade"),
    cargo: readList(sp, "cargo"),
    area: readList(sp, "area"),
    tag: readList(sp, "tag"),
    origem: readList(sp, "origem"),
    vaga: readList(sp, "vaga"),
    etapa: readList(sp, "etapa"),
    favorito: read(sp, "favorito") === "1",
    avaliacao: read(sp, "avaliacao") === "1",
    candidatura: readPreset(sp, "candidatura"),
    entrada: readPreset(sp, "entrada"),
    atividade: readPreset(sp, "atividade"),
  };
}

/** Filtros → parâmetros de URL (e o JSON salvo num segmento). Omite o que está vazio. */
export function serializeTalentFilters(f: TalentFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.q.trim()) out.q = f.q.trim();
  for (const key of LIST_KEYS) {
    const list = f[key] as string[];
    if (list.length > 0) out[key] = list.map((v) => v.replace(/\|/g, " ")).join("|");
  }
  if (f.favorito) out.favorito = "1";
  if (f.avaliacao) out.avaliacao = "1";
  for (const key of PRESET_KEYS) if (f[key]) out[key] = f[key];
  return out;
}

/** Quantos filtros do painel estão ativos (a busca e o favorito da aba ficam de fora). */
export function countActiveFilters(f: TalentFilters): number {
  let n = 0;
  for (const key of LIST_KEYS) n += (f[key] as string[]).length;
  if (f.avaliacao) n += 1;
  for (const key of PRESET_KEYS) if (f[key]) n += 1;
  return n;
}

export function hasAnyCriteria(f: TalentFilters): boolean {
  return countActiveFilters(f) > 0 || f.q.trim() !== "" || f.favorito;
}

export function sameFilters(a: TalentFilters, b: TalentFilters): boolean {
  const sa = serializeTalentFilters(a);
  const sb = serializeTalentFilters(b);
  const ka = Object.keys(sa).sort();
  const kb = Object.keys(sb).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sa[k] === sb[k]);
}

// ─── Ordenação ──────────────────────────────────────────────────────────────────────

export type TalentSort = "atividade" | "nome" | "entrada" | "candidatura" | "cargo";

export const SORT_OPTIONS: Array<{ value: TalentSort; label: string; column: string; defaultAsc: boolean }> = [
  { value: "atividade", label: "Última atividade", column: "ultimaAtividadeEm", defaultAsc: false },
  { value: "nome", label: "Nome", column: "nomeCompleto", defaultAsc: true },
  { value: "entrada", label: "Entrada no banco", column: "createdAt", defaultAsc: false },
  { value: "candidatura", label: "Última candidatura", column: "ultimaCandidaturaEm", defaultAsc: false },
  { value: "cargo", label: "Cargo de interesse", column: "cargoDesejado", defaultAsc: true },
];

export function parseSort(sp: ParamSource): { sort: TalentSort; asc: boolean } {
  const opt = SORT_OPTIONS.find((o) => o.value === read(sp, "ordem")) ?? SORT_OPTIONS[0];
  const dir = read(sp, "dir");
  return { sort: opt.value, asc: dir === "asc" ? true : dir === "desc" ? false : opt.defaultAsc };
}

// ─── Datas ──────────────────────────────────────────────────────────────────────────

const TZ = "America/Sao_Paulo";
const DAY = 86_400_000;

/**
 * Converte um preset em limites de data (ISO). `gte`: a partir de; `lt`: antes de;
 * `isNull`: campo vazio (ex.: nunca se candidatou).
 */
export function presetRange(preset: DatePreset, now: Date = new Date()): { gte?: string; lt?: string; isNull?: true } {
  const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  switch (preset) {
    case "7d":
      return { gte: ago(7) };
    case "30d":
      return { gte: ago(30) };
    case "90d":
      return { gte: ago(90) };
    case "180d":
      return { gte: ago(180) };
    case "365d":
      return { gte: ago(365) };
    case "sem90":
      return { lt: ago(90) };
    case "mais365":
      return { lt: ago(365) };
    case "nunca":
      return { isNull: true };
    case "mes":
      return { gte: startOfMonthSaoPaulo(now).toISOString() };
  }
}

/** 1º dia do mês corrente (00:00 em São Paulo, UTC−3). */
export function startOfMonthSaoPaulo(now: Date = new Date()): Date {
  const [y, m] = now.toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 3, 0, 0));
}

const MONTHS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

/** "Hoje", "Ontem", "22 set. 2026". */
export function relativeDay(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const key = new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const yesterday = new Date(now.getTime() - DAY).toLocaleDateString("en-CA", { timeZone: TZ });
  if (key === today) return "Hoje";
  if (key === yesterday) return "Ontem";
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "22/09/2026 às 14:32" (tooltip). */
export function fullDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { timeZone: TZ });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

// ─── Busca ──────────────────────────────────────────────────────────────────────────

/**
 * Termos da busca, no mesmo formato da coluna talentos_crm.busca (minúsculas, sem acento).
 * Cada termo precisa aparecer (E). Curingas do ILIKE são removidos.
 */
export function searchTerms(q: string): string[] {
  return normalizeText(q)
    .replace(/[%_*\\(),"']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .slice(0, 6);
}

// ─── Tags ───────────────────────────────────────────────────────────────────────────

/** "  excel   avançado " → "excel avançado" (a comparação de duplicidade ignora caixa). */
export function cleanTagName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 60);
}

export function sameTagName(a: string, b: string): boolean {
  return cleanTagName(a).toLocaleLowerCase("pt-BR") === cleanTagName(b).toLocaleLowerCase("pt-BR");
}

// ─── Contato / identidade ───────────────────────────────────────────────────────────

export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** Mesmo telefone: compara os dígitos, ignorando o 55 do DDI. Exige ao menos 10 dígitos. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const strip = (d: string) => (d.length > 11 && d.startsWith("55") ? d.slice(2) : d);
  const da = strip(phoneDigits(a));
  const db = strip(phoneDigits(b));
  return da.length >= 10 && da === db;
}

export function locationLabel(cidade: string | null | undefined, estado: string | null | undefined): string | null {
  const c = cidade?.trim();
  const e = estado?.trim();
  if (c && e) return `${c}, ${e}`;
  return c || e || null;
}

// ─── Etapas elegíveis ao adicionar a uma vaga ───────────────────────────────────────

export interface StageLike {
  id: string;
  kind: string;
  hideFromBoard?: boolean | null;
}

/**
 * Etapas em que um talento pode ENTRAR ao ser adicionado a uma vaga: etapas comuns e de
 * teste visíveis no quadro. Admissão/Contratado/Reprovado ficam de fora — exigem as
 * regras próprias do pipeline (cadastro da admissão, motivo de reprovação).
 */
export function entryStagesFor<T extends StageLike>(stages: T[]): T[] {
  return stages.filter((s) => (s.kind === "OPEN" || s.kind === "TEST") && !s.hideFromBoard);
}
