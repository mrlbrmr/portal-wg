// Modelos de vaga — módulo PURO (client-safe, testado em templates.test.ts).
//
// O modelo guarda o que se repete entre aberturas do mesmo cargo. Aplicar um modelo COPIA
// os valores para o rascunho da vaga: não existe vínculo vivo (editar/arquivar o modelo
// nunca altera uma vaga já criada; jobs.templateId é só a procedência).
//
// Prioridade quando há conflito (pedido do RH, 2026-10-13):
//   1. informação da solicitação aprovada  → NUNCA é sobrescrita pelo modelo;
//   2. informação já preenchida pelo RH    → só com ação explícita ("Substituir");
//   3. informação do modelo                → preenche o que está vazio.
//
// O que é da ABERTURA (posições, motivo, salário, prazos, status, publicação, unidade,
// cidade, solicitação) não existe no modelo e nunca é tocado aqui.
//
// O conteúdo segue o formato atual do editor (Markdown com ### por seção); a mescla é por
// seção, então "aplicar somente nos campos vazios" preserva o texto de cada seção que já
// tem conteúdo (inclusive o esqueleto gerado pela solicitação).

import { normalizeText } from "@/lib/utils";

// ─── Tipos ──────────────────────────────────────────────────────────────────────────────

export interface JobTemplate {
  id: string;
  name: string;
  title: string;
  department: string | null;
  contractType: string | null;
  workSchedule: string | null;
  /**
   * CONTEÚDO DA VAGA em Markdown, livre, exatamente como no editor da vaga (o RH escreve
   * seus próprios títulos). É a coluna usada pelo editor de modelos e por "Salvar como modelo".
   */
  about: string | null;
  /* Colunas por seção: formato da 1ª versão — só LIDAS (concatenadas depois de "about"
     em templateToMarkdown). Gravações novas deixam null. */
  responsibilities: string | null;
  requiredRequirements: string | null;
  desiredRequirements: string | null;
  benefits: string | null;
  active: boolean;
  updatedAt: string;
  updatedBy?: string | null;
}

/** Dados editáveis de um modelo (criação/edição/"Salvar como modelo"). */
export type JobTemplateInput = Omit<JobTemplate, "id" | "active" | "updatedAt" | "updatedBy">;

/** Campos do rascunho da vaga que um modelo pode preencher. */
export interface TemplateTarget {
  title: string;
  department: string;
  contractType: string;
  workSchedule: string;
  content: string;
  templateId: string | null;
}

export type TemplateField = "title" | "department" | "contractType" | "workSchedule";

export const TEMPLATE_FIELDS: readonly TemplateField[] = ["title", "department", "contractType", "workSchedule"];

export const TEMPLATE_FIELD_LABELS: Record<TemplateField | "content", string> = {
  title: "Título da vaga",
  department: "Área / departamento",
  contractType: "Tipo de contratação",
  workSchedule: "Horário de trabalho",
  content: "Conteúdo da vaga",
};

export const TEMPLATE_SELECT_COLUMNS =
  "id, name, title, department, contractType, workSchedule, about, responsibilities, requiredRequirements, desiredRequirements, benefits, active, updatedAt, updatedBy";

// ─── Seções do conteúdo ─────────────────────────────────────────────────────────────────

export type SectionKey = "responsibilities" | "requiredRequirements" | "desiredRequirements" | "benefits";

export const TEMPLATE_SECTIONS: ReadonlyArray<{ key: SectionKey; heading: string; aliases: string[] }> = [
  {
    key: "responsibilities",
    heading: "Responsabilidades",
    aliases: ["responsabilidades", "principais responsabilidades", "atividades", "principais atividades", "atribuicoes"],
  },
  {
    key: "requiredRequirements",
    heading: "Requisitos Obrigatórios",
    aliases: ["requisitos obrigatorios", "requisitos", "pre-requisitos", "pre requisitos", "qualificacoes"],
  },
  {
    key: "desiredRequirements",
    heading: "Requisitos Desejáveis",
    aliases: ["requisitos desejaveis", "desejaveis", "desejavel", "diferenciais"],
  },
  { key: "benefits", heading: "Benefícios", aliases: ["beneficios"] },
];

export interface ContentSection {
  level: number;
  heading: string;
  body: string;
}

export interface ParsedContent {
  preamble: string;
  sections: ContentSection[];
}

function normHeading(h: string): string {
  return normalizeText(h).replace(/[:.]+$/, "").replace(/\s+/g, " ").trim();
}

/** Seção padrão correspondente a um título ("### Requisitos" → requiredRequirements). */
export function sectionKeyOf(heading: string): SectionKey | null {
  const n = normHeading(heading);
  return TEMPLATE_SECTIONS.find((s) => s.aliases.includes(n))?.key ?? null;
}

function mergeKey(heading: string): string {
  return sectionKeyOf(heading) ?? `h:${normHeading(heading)}`;
}

/** Quebra o Markdown do editor em texto inicial + seções (títulos #, ## ou ###). */
export function parseContent(md: string): ParsedContent {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const preamble: string[] = [];
  const sections: Array<{ level: number; heading: string; lines: string[] }> = [];
  for (const line of lines) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) sections.push({ level: m[1].length, heading: m[2].trim(), lines: [] });
    else if (sections.length) sections[sections.length - 1].lines.push(line);
    else preamble.push(line);
  }
  return {
    preamble: preamble.join("\n").trim(),
    sections: sections.map((s) => ({ level: s.level, heading: s.heading, body: s.lines.join("\n").trim() })),
  };
}

export function renderContent(doc: ParsedContent): string {
  const parts: string[] = [];
  if (doc.preamble.trim()) parts.push(doc.preamble.trim());
  for (const s of doc.sections) {
    const title = `${"#".repeat(Math.min(Math.max(s.level, 1), 3))} ${s.heading}`;
    parts.push(s.body.trim() ? `${title}\n\n${s.body.trim()}` : title);
  }
  return parts.join("\n\n");
}

/** Conteúdo sem texto real: vazio, ou só os títulos do esqueleto (### Responsabilidades…). */
export function isContentBlank(md: string): boolean {
  const doc = parseContent(md);
  return !doc.preamble && doc.sections.every((s) => !s.body);
}

/** Markdown da vaga a partir do modelo — mesmo formato do editor (### por seção). */
export function templateToMarkdown(t: Pick<JobTemplate, "about" | SectionKey>): string {
  const parts: string[] = [];
  if (t.about?.trim()) parts.push(t.about.trim());
  for (const s of TEMPLATE_SECTIONS) {
    const body = t[s.key]?.trim();
    if (body) parts.push(`### ${s.heading}\n\n${body}`);
  }
  return parts.join("\n\n");
}

/**
 * Mescla o conteúdo do modelo no conteúdo atual.
 *   • "replace": o texto do modelo substitui tudo (ação explícita do RH);
 *   • "fill": seção a seção — a que já tem texto fica como está; as vazias recebem o texto
 *     do modelo; seções com texto que o modelo não tem são mantidas no fim; títulos vazios
 *     que o modelo não usa (ex.: "### Requisitos" do esqueleto) saem.
 * A ordem segue o modelo. Modelo sem conteúdo nunca apaga nada.
 */
export function mergeTemplateContent(current: string, templateMd: string, mode: ApplyMode): string {
  if (!templateMd.trim()) return current;
  if (mode === "replace" || isContentBlank(current)) return templateMd;

  const cur = parseContent(current);
  const tpl = parseContent(templateMd);
  const curByKey = new Map<string, ContentSection>();
  for (const s of cur.sections) if (!curByKey.has(mergeKey(s.heading))) curByKey.set(mergeKey(s.heading), s);

  const used = new Set<ContentSection>();
  const out: ContentSection[] = [];
  for (const t of tpl.sections) {
    const c = curByKey.get(mergeKey(t.heading));
    if (c) used.add(c);
    out.push(c && c.body ? c : t);
  }
  for (const c of cur.sections) if (!used.has(c) && c.body) out.push(c);

  return renderContent({ preamble: cur.preamble || tpl.preamble, sections: out });
}

/** Seções com texto que "Aplicar somente nos campos vazios" vai manter (para o aviso). */
export function keptSections(current: string, templateMd: string): string[] {
  if (isContentBlank(current)) return [];
  const tplKeys = new Set(parseContent(templateMd).sections.map((s) => mergeKey(s.heading)));
  const cur = parseContent(current);
  const kept = cur.sections.filter((s) => s.body && tplKeys.has(mergeKey(s.heading))).map((s) => s.heading);
  if (cur.preamble && parseContent(templateMd).preamble) kept.unshift("Texto de abertura");
  return kept;
}

// ─── Aplicação no rascunho ──────────────────────────────────────────────────────────────

export type ApplyMode = "fill" | "replace";

export interface ApplyOptions {
  /** Campos que vieram da solicitação aprovada — o modelo nunca os sobrescreve. */
  protectedFields?: ReadonlySet<string>;
  /** Valores iniciais de "Nova vaga" que contam como "não preenchido" (selects). */
  defaults?: Partial<Record<TemplateField, string>>;
}

export type FieldPlanStatus = "fill" | "same" | "conflict" | "protected";

export interface TemplatePlan {
  fields: Array<{ field: TemplateField; label: string; status: FieldPlanStatus; current: string; template: string }>;
  content: { status: "fill" | "same" | "conflict"; kept: string[] };
  /** Algo já preenchido seria afetado — pedir confirmação antes de aplicar. */
  needsConfirmation: boolean;
  /** Campos da solicitação que o modelo NÃO vai alterar (com valor diferente do modelo). */
  protectedConflicts: string[];
}

function templateValue(t: JobTemplate, f: TemplateField): string {
  return (t[f] ?? "").trim();
}

function isBlankField(target: TemplateTarget, f: TemplateField, opts: ApplyOptions): boolean {
  const v = (target[f] ?? "").trim();
  return v === "" || (opts.defaults?.[f] !== undefined && v === opts.defaults[f]);
}

/** O que acontece se o modelo for aplicado — base do aviso de conflito. */
export function planTemplate(target: TemplateTarget, t: JobTemplate, opts: ApplyOptions = {}): TemplatePlan {
  const fields: TemplatePlan["fields"] = [];
  for (const f of TEMPLATE_FIELDS) {
    const tv = templateValue(t, f);
    if (!tv) continue; // modelo sem valor nunca limpa o campo
    const cv = (target[f] ?? "").trim();
    let status: FieldPlanStatus;
    if (cv === tv) status = "same";
    else if (isBlankField(target, f, opts)) status = "fill";
    else if (opts.protectedFields?.has(f)) status = "protected";
    else status = "conflict";
    fields.push({ field: f, label: TEMPLATE_FIELD_LABELS[f], status, current: cv, template: tv });
  }

  const md = templateToMarkdown(t);
  let contentStatus: TemplatePlan["content"]["status"] = "same";
  if (md.trim() && target.content.trim() !== md.trim()) contentStatus = isContentBlank(target.content) ? "fill" : "conflict";

  const protectedConflicts = fields.filter((f) => f.status === "protected").map((f) => f.label);
  return {
    fields,
    content: { status: contentStatus, kept: contentStatus === "conflict" ? keptSections(target.content, md) : [] },
    needsConfirmation: contentStatus === "conflict" || fields.some((f) => f.status === "conflict" || f.status === "protected"),
    protectedConflicts,
  };
}

/**
 * Aplica o modelo ao rascunho. Retorna um NOVO objeto (o modelo é copiado; nada fica
 * referenciado). Campos da solicitação nunca mudam; campos preenchidos só mudam em
 * "replace"; vazios recebem o valor do modelo.
 */
export function applyTemplate<T extends TemplateTarget>(
  target: T,
  t: JobTemplate,
  mode: ApplyMode,
  opts: ApplyOptions = {}
): { draft: T; changed: Array<TemplateField | "content"> } {
  const plan = planTemplate(target, t, opts);
  const next: T = { ...target };
  const changed: Array<TemplateField | "content"> = [];
  for (const p of plan.fields) {
    if (p.status === "fill" || (p.status === "conflict" && mode === "replace")) {
      next[p.field] = p.template as T[TemplateField];
      changed.push(p.field);
    }
  }
  const content = mergeTemplateContent(target.content, templateToMarkdown(t), mode);
  if (content !== target.content) {
    next.content = content;
    changed.push("content");
  }
  next.templateId = t.id;
  return { draft: next, changed };
}

/**
 * Desfaz um modelo aplicado nesta sessão ("Remover modelo"/"Trocar modelo"): campos que
 * continuam com o valor que o modelo colocou voltam ao valor anterior; o que o RH editou
 * depois de aplicar fica.
 */
export function revertTemplate<T extends TemplateTarget>(current: T, before: T, applied: T): T {
  const next: T = { ...current, templateId: before.templateId };
  for (const f of [...TEMPLATE_FIELDS, "content"] as const) {
    if (current[f] === applied[f]) next[f] = before[f];
  }
  return next;
}

// ─── Salvar vaga como modelo ────────────────────────────────────────────────────────────

export interface SaveAsTemplateOptions {
  name: string;
  department: string;
  include: { general: boolean; content: boolean };
}

/** Grava o conteúdo como um único Markdown (o editor de modelos trabalha assim). */
export function withContent<T extends Pick<JobTemplateInput, "about" | SectionKey>>(input: T, content: string): T {
  return {
    ...input,
    about: content.trim() || null,
    responsibilities: null,
    requiredRequirements: null,
    desiredRequirements: null,
    benefits: null,
  };
}

/**
 * Modelo a partir do rascunho da vaga. Nunca leva o que é da abertura (candidatos, datas,
 * status, publicação, solicitação, posições, motivo, salário, histórico).
 *   • `general` = contratação e horário;
 *   • `content` = o "Conteúdo da vaga" inteiro, como está (Markdown livre — sem exigir
 *     títulos padrão).
 */
export function templateFromJob(
  job: Pick<TemplateTarget, "title" | "contractType" | "workSchedule" | "content">,
  opts: SaveAsTemplateOptions
): JobTemplateInput {
  const { general, content } = opts.include;
  // Esqueleto sem texto (só títulos) não vira conteúdo de modelo.
  const text = content && !isContentBlank(job.content) ? job.content : "";
  return withContent(
    {
      name: opts.name.trim(),
      title: job.title.trim(),
      department: opts.department.trim() || null,
      contractType: general ? job.contractType || null : null,
      workSchedule: general ? job.workSchedule.trim() || null : null,
      about: null,
      responsibilities: null,
      requiredRequirements: null,
      desiredRequirements: null,
      benefits: null,
    },
    text
  );
}

/** Nome para "Duplicar": "X (cópia)", "X (cópia 2)"… sem colidir (ignora caixa/acentos). */
export function duplicateName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => normalizeText(n.trim())));
  const base = `${name.trim()} (cópia)`;
  if (!taken.has(normalizeText(base))) return base;
  for (let i = 2; ; i++) {
    const candidate = `${name.trim()} (cópia ${i})`;
    if (!taken.has(normalizeText(candidate))) return candidate;
  }
}

/** Busca do combobox: nome, cargo e área, sem acento/caixa. */
export function matchesTemplate(t: Pick<JobTemplate, "name" | "title" | "department">, query: string): boolean {
  const q = normalizeText(query.trim());
  if (!q) return true;
  return [t.name, t.title, t.department ?? ""].some((v) => normalizeText(v).includes(q));
}
