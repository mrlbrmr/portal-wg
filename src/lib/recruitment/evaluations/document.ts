// Conteúdo do PARECER (documento do editor TipTap, em JSON) — módulo PURO (client-safe).
//
// O banco guarda o JSON estruturado do editor, nunca HTML. Antes de gravar, o servidor
// passa o documento por `sanitizeReportDoc`: lista branca de nós/marcas/atributos, links só
// http/https/mailto, limites de tamanho e profundidade. Tudo que não está na lista some.
// A leitura renderiza a partir desse JSON pelo schema do editor (sem innerHTML).

export interface ReportMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface ReportNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ReportNode[];
  marks?: ReportMark[];
  text?: string;
}

export interface ReportDoc {
  type: "doc";
  content: ReportNode[];
}

export const REPORT_MAX_TEXT = 200_000;
const MAX_NODES = 20_000;
const MAX_DEPTH = 40;

const BLOCK_NODES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "codeBlock",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
]);
const INLINE_NODES = new Set(["text", "hardBreak"]);
const MARKS = new Set(["bold", "italic", "strike", "underline", "code", "link"]);

const SAFE_HREF = /^(https?:\/\/|mailto:)[^\s<>"'`]+$/i;

/** Link seguro: só http(s) e mailto, sem espaço/aspas (bloqueia javascript:, data: etc.). */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const href = raw.trim();
  if (href.length > 2048 || !SAFE_HREF.test(href)) return null;
  return href;
}

function int(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function cleanAttrs(type: string, attrs: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const a = attrs ?? {};
  switch (type) {
    case "heading":
      return { level: Math.min(3, Math.max(1, int(a.level, 1, 6) ?? 2)) };
    case "orderedList": {
      const start = int(a.start, 0, 100_000);
      return start !== null && start !== 1 ? { start } : undefined;
    }
    case "codeBlock": {
      const lang = typeof a.language === "string" && /^[a-z0-9+#-]{1,32}$/i.test(a.language) ? a.language : null;
      return lang ? { language: lang } : undefined;
    }
    case "tableCell":
    case "tableHeader": {
      const out: Record<string, unknown> = {};
      const colspan = int(a.colspan, 1, 50);
      const rowspan = int(a.rowspan, 1, 50);
      if (colspan && colspan > 1) out.colspan = colspan;
      if (rowspan && rowspan > 1) out.rowspan = rowspan;
      if (Array.isArray(a.colwidth) && a.colwidth.every((w) => int(w, 1, 4000) !== null) && a.colwidth.length <= 50) {
        out.colwidth = a.colwidth;
      }
      return Object.keys(out).length ? out : undefined;
    }
    default:
      return undefined;
  }
}

function cleanMarks(marks: unknown): ReportMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out: ReportMark[] = [];
  const seen = new Set<string>();
  for (const m of marks) {
    if (!m || typeof m !== "object") continue;
    const type = (m as ReportMark).type;
    if (typeof type !== "string" || !MARKS.has(type) || seen.has(type)) continue;
    if (type === "link") {
      const href = safeHref((m as ReportMark).attrs?.href);
      if (!href) continue; // link inseguro: o texto fica, o link sai
      out.push({ type, attrs: { href, target: "_blank", rel: "noopener noreferrer nofollow" } });
    } else {
      out.push({ type });
    }
    seen.add(type);
  }
  return out.length ? out : undefined;
}

export type SanitizeResult = { ok: true; doc: ReportDoc; text: string } | { ok: false; error: string };

/** Valida e limpa o documento vindo do cliente. Nunca confie no JSON recebido. */
export function sanitizeReportDoc(input: unknown): SanitizeResult {
  if (!input || typeof input !== "object" || (input as ReportNode).type !== "doc") {
    return { ok: false, error: "Conteúdo do parecer inválido." };
  }
  let nodes = 0;
  let textLength = 0;
  let tooBig = false;

  const walk = (raw: unknown, depth: number): ReportNode | null => {
    if (tooBig || !raw || typeof raw !== "object") return null;
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) {
      tooBig = true;
      return null;
    }
    const node = raw as ReportNode;
    const type = node.type;
    if (type === "text") {
      if (typeof node.text !== "string" || node.text.length === 0) return null;
      textLength += node.text.length;
      if (textLength > REPORT_MAX_TEXT) {
        tooBig = true;
        return null;
      }
      const marks = cleanMarks(node.marks);
      return marks ? { type, text: node.text, marks } : { type, text: node.text };
    }
    if (type === "hardBreak") return { type };
    if (typeof type !== "string" || !BLOCK_NODES.has(type)) return null; // nó desconhecido some
    const out: ReportNode = { type };
    const attrs = cleanAttrs(type, node.attrs);
    if (attrs) out.attrs = attrs;
    if (type !== "horizontalRule" && Array.isArray(node.content)) {
      const children = node.content.map((c) => walk(c, depth + 1)).filter((c): c is ReportNode => c !== null);
      if (children.length) out.content = children;
    }
    return out;
  };

  const content = Array.isArray((input as ReportNode).content)
    ? ((input as ReportNode).content as unknown[]).map((c) => walk(c, 1)).filter((c): c is ReportNode => c !== null)
    : [];
  if (tooBig) return { ok: false, error: "O parecer passou do tamanho máximo. Divida o conteúdo." };
  // Inline solto no topo não é válido no schema do editor.
  const doc: ReportDoc = { type: "doc", content: content.filter((n) => !INLINE_NODES.has(n.type)) };
  const text = docToPlainText(doc);
  if (!text.trim()) return { ok: false, error: "Escreva o parecer antes de salvar." };
  return { ok: true, doc, text };
}

function inlineText(node: ReportNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(inlineText).join("");
}

/** Texto puro do documento (trecho da lista, buscas futuras). Um bloco por linha. */
export function docToPlainText(doc: ReportDoc | null | undefined): string {
  if (!doc?.content) return "";
  const lines: string[] = [];
  const block = (node: ReportNode, prefix = "") => {
    switch (node.type) {
      case "paragraph":
      case "heading":
      case "codeBlock": {
        const t = inlineText(node).trim();
        if (t) lines.push(prefix + t);
        return;
      }
      case "bulletList":
      case "orderedList":
        (node.content ?? []).forEach((item) => (item.content ?? []).forEach((c, i) => block(c, i === 0 ? "- " : "  ")));
        return;
      case "blockquote":
        (node.content ?? []).forEach((c) => block(c, prefix));
        return;
      case "table":
        (node.content ?? []).forEach((row) => {
          const cells = (row.content ?? []).map((cell) => (cell.content ?? []).map(inlineText).join(" ").trim());
          if (cells.some(Boolean)) lines.push(cells.join(" | "));
        });
        return;
      default:
        (node.content ?? []).forEach((c) => block(c, prefix));
    }
  };
  doc.content.forEach((n) => block(n));
  return lines.join("\n");
}

/**
 * Trecho para a lista: o primeiro parágrafo de texto corrido (títulos e tabelas não
 * contam — "Síntese do perfil" não diz nada sobre o candidato). Corta em palavra inteira.
 */
export function reportExcerpt(doc: ReportDoc | null | undefined, max = 180): string {
  let found = "";
  const visit = (nodes: ReportNode[] | undefined) => {
    for (const n of nodes ?? []) {
      if (found) return;
      if (n.type === "heading" || n.type === "table" || n.type === "codeBlock") continue;
      if (n.type === "paragraph") {
        const t = inlineText(n).replace(/\s+/g, " ").trim();
        if (t) found = t;
        continue;
      }
      visit(n.content);
    }
  };
  visit(doc?.content);
  return truncateWords(found, max);
}

export function truncateWords(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

/** Documento a partir de texto puro (parecer antigo, gravado em `summary`). */
export function docFromPlainText(text: string | null | undefined): ReportDoc {
  const paragraphs = (text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paragraphs.map((p) => {
      const parts = p.split("\n");
      const content: ReportNode[] = [];
      parts.forEach((line, i) => {
        if (i > 0) content.push({ type: "hardBreak" });
        if (line) content.push({ type: "text", text: line });
      });
      return { type: "paragraph", content };
    }),
  };
}

export function isReportDoc(v: unknown): v is ReportDoc {
  return !!v && typeof v === "object" && (v as ReportDoc).type === "doc" && Array.isArray((v as ReportDoc).content);
}

/** Documento de uma entrevista: o conteúdo do editor ou, em registro antigo, o texto de `summary`. */
export function interviewDoc(item: { content?: unknown; summary?: string | null }): ReportDoc {
  return isReportDoc(item.content) ? item.content : docFromPlainText(item.summary);
}
