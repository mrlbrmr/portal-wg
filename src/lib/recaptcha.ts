// Verificação server-side do reCAPTCHA v3 — ADVISORY (sinal, não portão).
//
// O reCAPTCHA v3 NÃO devolve um pass/fail: devolve um SCORE probabilístico. Em
// mobile ele gera falso-positivo com frequência e barra candidatos REAIS:
//   - iOS (Prevenção de Rastreamento do Safari / content blockers) bloqueia o
//     script → o token nunca é gerado → chega "missing_token";
//   - o score de celular costuma vir baixo mesmo sendo humano;
//   - em 4G lento o token expira (~2 min) enquanto o currículo faz upload →
//     "timeout-or-duplicate".
//
// Por isso tratamos o resultado como SINAL: só bloqueamos quando o Google
// confirma, com um token válido, um score claramente de bot (< RECAPTCHA_BLOCK_SCORE).
// Casos ambíguos passam (e são logados). A defesa anti-abuso real é o rate-limit
// por IP + a revisão manual das candidaturas no Kanban.

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

// Só bloqueia abaixo disto (token válido + score muito baixo = bot evidente).
// Conservador de propósito: humanos raramente pontuam tão baixo.
export const RECAPTCHA_BLOCK_SCORE = 0.3;

export interface RecaptchaResult {
  ok: boolean; // false só quando é bot evidente (deve bloquear a candidatura)
  score?: number;
  reason?: string; // motivo do sinal, para telemetria
}

/**
 * Verifica um token do reCAPTCHA v3 de forma consultiva.
 * - Sem RECAPTCHA_SECRET_KEY → ok:true (fail-open, dev).
 * - Retorna ok:false SOMENTE para bot evidente (token válido + score baixo);
 *   token ausente/expirado/inválido e falhas de rede NÃO bloqueiam.
 */
export async function verifyRecaptcha(
  token: string | null | undefined,
  opts: { expectedAction?: string; remoteIp?: string } = {}
): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  // Sem secret configurada → não bloqueia (dev). Em produção a chave está setada.
  if (!secret) {
    return { ok: true, reason: "recaptcha_disabled" };
  }

  // Token ausente costuma ser mobile com o script bloqueado (ITP/content blocker),
  // não bot — não bloqueia.
  if (!token) {
    return { ok: true, reason: "missing_token" };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (opts.remoteIp) body.set("remoteip", opts.remoteIp);

  let data: {
    success?: boolean;
    score?: number;
    action?: string;
    ["error-codes"]?: string[];
  };
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    data = await res.json();
  } catch {
    // Falha ao falar com o Google não pode derrubar a candidatura.
    return { ok: true, reason: "verify_request_failed" };
  }

  // Token expirado/duplicado ou inválido: em 4G lento é comum (o token do v3
  // expira antes de o upload do currículo terminar). Não bloqueia.
  if (!data.success) {
    return { ok: true, reason: (data["error-codes"] ?? ["failed"]).join(",") };
  }

  const score = data.score ?? 1;

  // Action divergente pode indicar reuso, mas também cache/pré-render — só bloqueia
  // se, além disso, o score for de bot.
  if (opts.expectedAction && data.action && data.action !== opts.expectedAction) {
    return { ok: score >= RECAPTCHA_BLOCK_SCORE, score, reason: "action_mismatch" };
  }

  if (score < RECAPTCHA_BLOCK_SCORE) {
    return { ok: false, score, reason: "low_score" };
  }

  return { ok: true, score };
}
