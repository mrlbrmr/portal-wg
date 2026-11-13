// Proteção do formulário PÚBLICO de solicitação (/solicitar-vaga), que não tem login.
// Três camadas, da mais barata à mais cara: campo-isca (robôs simples preenchem todos os
// campos), reCAPTCHA v3 consultivo (src/lib/recaptcha.ts — só barra bot evidente) e o
// limite por IP da rota. Nenhuma delas pode barrar um gestor de verdade.

/** Campo escondido de pessoas (fora da tela, sem tab, sem autocomplete). */
export const HONEYPOT_FIELD = "website";

export function isHoneypotFilled(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const value = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  return typeof value === "string" && value.trim().length > 0;
}
