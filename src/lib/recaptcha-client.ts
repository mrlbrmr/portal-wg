// reCAPTCHA v3 no navegador: carrega o script sob demanda e devolve um token, ou null
// quando não há chave, o script foi bloqueado (iOS/ITP, bloqueador) ou falhou. O servidor
// trata o resultado como SINAL (src/lib/recaptcha.ts): token ausente nunca barra ninguém.

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

let recaptchaLoading: Promise<void> | null = null;

function loadRecaptcha(): Promise<void> {
  if (!SITE_KEY) return Promise.resolve();
  if (typeof window !== "undefined" && (window as unknown as { grecaptcha?: unknown }).grecaptcha) {
    return Promise.resolve();
  }
  if (recaptchaLoading) return recaptchaLoading;
  recaptchaLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      recaptchaLoading = null;
      reject(new Error("recaptcha_load_failed"));
    };
    document.head.appendChild(s);
  });
  return recaptchaLoading;
}

export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (!SITE_KEY) return null;
  try {
    await loadRecaptcha();
    const grecaptcha = (window as unknown as {
      grecaptcha?: { ready: (cb: () => void) => void; execute: (k: string, o: { action: string }) => Promise<string> };
    }).grecaptcha;
    if (!grecaptcha) return null;
    return await new Promise<string>((resolve) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(SITE_KEY as string, { action }).then(resolve);
      });
    });
  } catch {
    return null;
  }
}
