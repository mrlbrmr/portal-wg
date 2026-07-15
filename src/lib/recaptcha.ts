// Verificação server-side do reCAPTCHA v3.
// O cliente gera um token com grecaptcha.execute(); aqui validamos contra a API
// do Google usando RECAPTCHA_SECRET_KEY e conferimos o score.

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

// Score mínimo aceito (0.0 = provável bot, 1.0 = provável humano).
export const RECAPTCHA_MIN_SCORE = 0.5;

export interface RecaptchaResult {
  ok: boolean;
  score?: number;
  reason?: string;
}

/**
 * Verifica um token do reCAPTCHA v3.
 * - Se RECAPTCHA_SECRET_KEY não estiver configurada, retorna ok:true (fail-open)
 *   para não travar o ambiente de desenvolvimento — em produção a chave existe.
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

  if (!token) {
    return { ok: false, reason: "missing_token" };
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
    return { ok: false, reason: "verify_request_failed" };
  }

  if (!data.success) {
    return { ok: false, reason: (data["error-codes"] ?? ["failed"]).join(",") };
  }

  // Confere a action, se esperada (defesa extra contra reuso de token).
  if (opts.expectedAction && data.action && data.action !== opts.expectedAction) {
    return { ok: false, score: data.score, reason: "action_mismatch" };
  }

  const score = data.score ?? 0;
  if (score < RECAPTCHA_MIN_SCORE) {
    return { ok: false, score, reason: "low_score" };
  }

  return { ok: true, score };
}
