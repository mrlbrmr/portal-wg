// Critérios de triagem do candidato — extraídos dos requisitos REAIS da vaga.
//
// Não existe (ainda) um modelo estruturado de critérios no banco. Os requisitos vivem
// no HTML da vaga: em vagas legadas no campo `requiredRequirements`; nas atuais, como
// uma seção "## Requisitos obrigatórios" dentro de `description` (o JobForm gera
// <h2>…</h2><ul><li>…</li></ul>). Esta função só LÊ essa lista — não inventa critérios
// nem calcula nota. O registro "Atende / Não atende" por critério depende de backend
// (tabela própria) e está fora do escopo atual.

const MAX_CRITERIA = 15;

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

function listItems(html: string): string[] {
  return [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => toText(m[1])).filter(Boolean);
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = it.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out.slice(0, MAX_CRITERIA);
}

/** Seção de requisitos obrigatórios dentro da descrição (ignora "desejáveis"/"diferenciais"). */
function requirementsSection(description: string): string | null {
  const headings = [...description.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  for (let i = 0; i < headings.length; i++) {
    const title = toText(headings[i][2]).toLowerCase();
    if (!/requisito/.test(title) || /desej|diferencia/.test(title)) continue;
    const start = (headings[i].index ?? 0) + headings[i][0].length;
    const end = i + 1 < headings.length ? headings[i + 1].index ?? description.length : description.length;
    return description.slice(start, end);
  }
  return null;
}

export function extractScreeningCriteria(input: {
  requiredRequirements?: string | null;
  description?: string | null;
}): string[] {
  const legacy = input.requiredRequirements?.trim();
  if (legacy) {
    const items = listItems(legacy);
    if (items.length > 0) return uniq(items);
    // Texto corrido: um requisito por parágrafo/linha.
    const lines = legacy
      .split(/<\/p>|<br\s*\/?>|\n/i)
      .map(toText)
      .filter((l) => l.length > 2);
    return uniq(lines);
  }

  const description = input.description ?? "";
  const section = requirementsSection(description);
  return section ? uniq(listItems(section)) : [];
}
