// Markdown do parecer gerado fora do Portal (Claude/ChatGPT) → HTML seguro para o editor.
// Módulo PURO (client-safe; roda também no Node, por isso é testável).
//
// Fluxo: Markdown (GFM: tabelas, listas, citações) → `marked` → HTML → editor TipTap, que só
// aceita os nós do próprio schema. Mesmo assim o HTML sai seguro daqui: HTML cru do texto é
// ESCAPADO (vira texto visível, exceto <br>), imagens viram o texto alternativo, links só
// http/https/mailto e títulos H4–H6 viram H3. O servidor valida o JSON final de novo.

import { Marked, type Tokens } from "marked";
import { safeHref } from "./document";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const BR = /^<br\s*\/?>$/i;

const parser = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    // HTML cru: <br> (comum em células de tabela geradas por IA) passa; o resto vira texto.
    html({ text }: Tokens.HTML | Tokens.Tag) {
      const t = text.trim();
      return BR.test(t) ? "<br>" : escapeHtml(text);
    },
    heading({ tokens, depth }: Tokens.Heading) {
      const level = Math.min(3, depth);
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    },
    link({ href, tokens }: Tokens.Link) {
      const inner = this.parser.parseInline(tokens);
      const safe = safeHref(href);
      return safe ? `<a href="${escapeHtml(safe)}">${inner}</a>` : inner;
    },
    image({ text }: Tokens.Image) {
      return escapeHtml(text ?? "");
    },
    checkbox({ checked }: Tokens.Checkbox) {
      return checked ? "☑ " : "☐ ";
    },
  },
});

/** Markdown → HTML seguro (vazio quando não há texto). */
export function markdownToEditorHtml(markdown: string): string {
  const md = markdown.replace(/\r\n?/g, "\n").trim();
  if (!md) return "";
  return parser.parse(md, { async: false }) as string;
}

/**
 * O texto colado parece Markdown? Usado ao colar texto puro no editor: só converte quando
 * há sinal forte (título, tabela, bloco de código) ou dois sinais fracos (lista, negrito,
 * citação, link). Texto comum continua sendo colado como texto.
 */
export function looksLikeMarkdown(text: string): boolean {
  const t = text.replace(/\r\n?/g, "\n");
  if (/^#{1,6}\s+\S/m.test(t)) return true;
  if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m.test(t)) return true;
  if (/^```/m.test(t)) return true;
  let weak = 0;
  if ((t.match(/^\s*([-*+]|\d+[.)])\s+\S/gm) ?? []).length >= 2) weak++;
  if (/\*\*[^*\n]+\*\*|__[^_\n]+__/.test(t)) weak++;
  if (/^>\s+\S/m.test(t)) weak++;
  if (/\[[^\]\n]+\]\((https?:|mailto:)[^)\s]+\)/.test(t)) weak++;
  if (/^(-{3,}|\*{3,})\s*$/m.test(t)) weak++;
  return weak >= 2;
}
