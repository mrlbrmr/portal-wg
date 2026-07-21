"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2, CheckCircle2, Upload, Paperclip } from "lucide-react";
import { maskPhone } from "@/lib/utils";

interface Props {
  jobId: string;
  jobTitle: string;
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const MAX_MB = 5;
const ACCEPT = ".pdf,.doc,.docx";

// Carrega o script do reCAPTCHA v3 sob demanda e devolve um token.
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
    s.onerror = () => reject(new Error("recaptcha_load_failed"));
    document.head.appendChild(s);
  });
  return recaptchaLoading;
}

async function getRecaptchaToken(): Promise<string | null> {
  if (!SITE_KEY) return null;
  try {
    await loadRecaptcha();
    const grecaptcha = (window as unknown as {
      grecaptcha?: { ready: (cb: () => void) => void; execute: (k: string, o: { action: string }) => Promise<string> };
    }).grecaptcha;
    if (!grecaptcha) return null;
    return await new Promise<string>((resolve) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(SITE_KEY as string, { action: "submit_application" }).then(resolve);
      });
    });
  } catch {
    return null;
  }
}

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";

export function ApplicationForm({ jobId, jobTitle }: Props) {
  const [phone, setPhone] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) {
      setFileName(null);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`O currículo excede o limite de ${MAX_MB} MB.`);
      e.target.value = "";
      setFileName(null);
      return;
    }
    setFileName(f.name);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formEl = e.currentTarget;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Anexe seu currículo (PDF, DOC ou DOCX).");
      return;
    }

    setIsLoading(true);
    try {
      const token = await getRecaptchaToken();

      const data = new FormData(formEl);
      data.set("jobId", jobId);
      data.set("phone", phone);
      if (token) data.set("recaptchaToken", token);

      const res = await fetch("/api/applications", {
        method: "POST",
        body: data,
      });

      if (!res.ok) {
        let message = "Não foi possível enviar sua inscrição. Tente novamente.";
        try {
          const j = await res.json();
          if (typeof j.error === "string") message = j.error;
        } catch {
          /* mantém mensagem padrão */
        }
        setError(message);
        return;
      }

      setDone(true);
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        <CheckCircle2 className="w-12 h-12 text-wg-green mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900 mb-1">Inscrição enviada!</h3>
        <p className="text-sm text-gray-600">
          Recebemos sua candidatura para <strong>{jobTitle}</strong>. Seu currículo será
          avaliado pela nossa equipe de Gente &amp; Gestão e, caso esteja dentro do perfil
          da vaga, entraremos em contato. Agradecemos o seu interesse em fazer parte do
          Grupo WG!
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
      noValidate
    >
      <h3 className="text-base font-semibold text-gray-900 mb-4">Inscreva-se nesta vaga</h3>

      <div className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
            Nome completo <span className="text-red-500">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            autoComplete="name"
            placeholder="Seu nome completo"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            E-mail <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
            placeholder="seunome@email.com"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Celular <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            placeholder="(11) 9 1234-5678"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Currículo <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileRef}
            name="resume"
            type="file"
            accept={ACCEPT}
            onChange={onFileChange}
            className="sr-only"
            id="resume-input"
          />
          <label
            htmlFor="resume-input"
            className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 hover:border-wg-green rounded-lg px-3 py-3 text-sm text-gray-600 transition-colors"
          >
            {fileName ? (
              <>
                <Paperclip className="w-4 h-4 text-wg-green shrink-0" />
                <span className="truncate text-gray-900">{fileName}</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-gray-400 shrink-0" />
                <span>Anexar currículo (PDF, DOC ou DOCX — até {MAX_MB} MB)</span>
              </>
            )}
          </label>
        </div>

        <label className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
          <input
            type="checkbox"
            name="consent"
            value="true"
            required
            className="mt-0.5 accent-wg-green"
          />
          <span>
            Li e concordo com o tratamento dos meus dados pessoais conforme o{" "}
            <a href="/privacidade" target="_blank" className="text-wg-green underline hover:text-wg-green-dark">
              Aviso de Privacidade
            </a>{" "}
            (LGPD).
          </span>
        </label>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-wg-green hover:bg-wg-green-bright disabled:opacity-60 text-black font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            "Enviar inscrição"
          )}
        </button>

        {SITE_KEY && (
          <p className="text-[11px] text-gray-400 text-center">
            Protegido por reCAPTCHA. Aplicam-se a{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              Privacidade
            </a>{" "}
            e os{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">
              Termos
            </a>{" "}
            do Google.
          </p>
        )}
      </div>
    </form>
  );
}
