// Base URL absoluta e normalizada do portal. Fonte única de verdade para todas
// as URLs geradas (JSON-LD, sitemap, feeds, OG, OAuth, links de divulgação).
//
// Garante que o valor sempre tenha esquema https:// e não tenha barra final,
// mesmo que NEXT_PUBLIC_APP_URL venha sem "https://" ou com "/" no fim — evita
// URLs quebradas e mismatch de redirect_uri no OAuth. Client-safe.
export function getAppBaseUrl(): string {
  let base = (process.env.NEXT_PUBLIC_APP_URL ?? "carreiras.wgbaterias.com.br").trim();
  base = base.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base;
}
