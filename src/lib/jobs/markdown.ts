// Conteúdo da vaga em Markdown ⇄ HTML gravado em jobs.description. Client-safe e puro.
//
// O editor trabalha em Markdown; o banco guarda HTML simples (h1-h3, p, ul/li, strong, em,
// code). A conversão de volta existe porque description pode conter Markdown puro (vaga
// recém-criada pela solicitação) ou HTML já convertido (vaga salva pelo editor).

import type { Job } from "@/types/domain";

export const MARKDOWN_BOILERPLATE = [
  "### Responsabilidades",
  "",
  "",
  "### Requisitos Obrigatórios",
  "",
  "",
  "### Requisitos Desejáveis",
  "",
  "",
  "### Benefícios",
  "",
].join("\n");

function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export function markdownToHtml(md: string): string {
  if (!md.trim()) {
    return '<p style="color:#9ca3af;font-style:italic">Nenhum conteúdo ainda.</p>';
  }
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("### ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function unescapeInline(s: string): string {
  return decodeEntities(s)
    .replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/g, "**$1**")
    .replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/g, "*$1*")
    .replace(/<code>([\s\S]*?)<\/code>/g, "`$1`")
    .replace(/<br\s*\/?>/g, "\n")
    .trim();
}

// Remove um <p>...</p> externo redundante que embrulha outro bloco (sintoma
// de uma vaga que já foi salva 2x pelo fluxo antigo: tudo virou uma única
// linha "escapada" dentro de um <p>).
function stripRedundantWrapper(html: string): string {
  const m = /^<p>([\s\S]*)<\/p>$/.exec(html.trim());
  if (m && /^<(?:p|h1|h2|h3|ul)[ >]/.test(m[1])) {
    return m[1];
  }
  return html;
}

// Reverte o HTML gerado por markdownToHtml de volta para Markdown-fonte.
// Necessário porque `description` pode conter Markdown puro (vaga recém-criada
// via solicitação, ainda não editada no JobForm) ou HTML já convertido (vaga
// salva ao menos uma vez pelo JobForm) — sem isso, reabrir uma vaga já
// convertida faz o Markdown-fonte virar o próprio HTML, e salvar de novo
// escapa as tags (double-encoding) em vez de reconvertê-las.
export function htmlToMarkdown(raw: string): string {
  const html = stripRedundantWrapper(decodeEntities(raw));
  const blocks: string[] = [];
  const blockRegex =
    /<h1>([\s\S]*?)<\/h1>|<h2>([\s\S]*?)<\/h2>|<h3>([\s\S]*?)<\/h3>|<ul>([\s\S]*?)<\/ul>|<p>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html))) {
    const [, h1, h2, h3, ul, p] = match;
    if (h1 !== undefined) blocks.push(`# ${unescapeInline(h1)}`);
    else if (h2 !== undefined) blocks.push(`## ${unescapeInline(h2)}`);
    else if (h3 !== undefined) blocks.push(`### ${unescapeInline(h3)}`);
    else if (ul !== undefined) {
      const items = [...ul.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(
        (m) => `- ${unescapeInline(m[1])}`
      );
      blocks.push(items.join("\n"));
    } else if (p !== undefined) {
      blocks.push(unescapeInline(p));
    }
  }
  return blocks.length > 0 ? blocks.join("\n\n") : unescapeInline(html);
}

export function buildInitialContent(job?: Pick<Job, "description" | "responsibilities" | "requiredRequirements" | "desiredRequirements" | "benefits">): string {
  if (!job) return MARKDOWN_BOILERPLATE;
  const hasLegacy =
    job.responsibilities ||
    job.requiredRequirements ||
    job.desiredRequirements ||
    job.benefits;
  if (!hasLegacy) return job.description ? htmlToMarkdown(job.description) : MARKDOWN_BOILERPLATE;
  const parts: string[] = [];
  if (job.description) parts.push(htmlToMarkdown(job.description));
  if (job.responsibilities) parts.push(`## Responsabilidades\n${htmlToMarkdown(job.responsibilities)}`);
  if (job.requiredRequirements) parts.push(`## Requisitos Obrigatórios\n${htmlToMarkdown(job.requiredRequirements)}`);
  if (job.desiredRequirements) parts.push(`## Requisitos Desejáveis\n${htmlToMarkdown(job.desiredRequirements)}`);
  if (job.benefits) parts.push(`## Benefícios\n${htmlToMarkdown(job.benefits)}`);
  return parts.join("\n\n");
}
