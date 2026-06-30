export function sanitizeRichText(html: string): string {
  if (!html) return "";
  return html
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/(?:javascript|data|vbscript):\s*/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|base|meta|link)(\s[^>]*)?>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|base|meta|link)(\s[^>]*)?\/?>gi/gi, "");
}

export function extractText(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
