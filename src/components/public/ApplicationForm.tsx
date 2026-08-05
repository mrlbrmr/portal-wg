"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2, CheckCircle2, Upload, Paperclip } from "lucide-react";
import { maskPhone } from "@/lib/utils";
import { COUNTRIES } from "@/lib/data/countries";

interface Props {
  jobId: string;
  jobTitle: string;
  jobCity?: string | null;
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
    s.onerror = () => {
      recaptchaLoading = null;
      reject(new Error("recaptcha_load_failed"));
    };
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

const IBGE_CACHE_KEY = "wg_ibge_cities";
const IBGE_CACHE_TTL = 24 * 60 * 60 * 1000;

async function loadCities(): Promise<string[]> {
  try {
    const raw = sessionStorage.getItem(IBGE_CACHE_KEY);
    if (raw) {
      const { data, ts } = JSON.parse(raw) as { data: string[]; ts: number };
      if (Date.now() - ts < IBGE_CACHE_TTL) return data;
    }
  } catch {}
  const res = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome"
  );
  const data = ((await res.json()) as Array<{ nome: string }>).map((m) => m.nome);
  try { sessionStorage.setItem(IBGE_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
  return data;
}

const inputClass =
  "w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/30 focus:border-wg-green transition-colors";

const labelClass = "block text-[13.5px] font-semibold text-gray-700 mb-1.5";

export function ApplicationForm({ jobId, jobTitle, jobCity }: Props) {
  const [phone, setPhone] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const citiesLoadedRef = useRef(false);
  const [salaryDisplay, setSalaryDisplay] = useState("");
  const [salaryValue, setSalaryValue] = useState(""); // valor numérico em string ("3500.00")
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Carrega cidades na primeira vez que o campo é focado.
  const handleCityFocus = useCallback(async () => {
    if (citiesLoadedRef.current) return;
    citiesLoadedRef.current = true;
    try {
      const list = await loadCities();
      setCities(list);
    } catch {
      /* silencioso: o campo continua funcionando como texto livre */
    }
  }, []);

  function handleSalary(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      setSalaryDisplay("");
      setSalaryValue("");
      return;
    }
    const cents = parseInt(digits, 10);
    setSalaryDisplay(
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
    );
    setSalaryValue(String(cents / 100));
  }

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) { setFileName(null); return; }
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
      data.set("salaryExpectation", salaryValue);
      if (token) data.set("recaptchaToken", token);

      const res = await fetch("/api/applications", { method: "POST", body: data });

      if (!res.ok) {
        let message = "Não foi possível enviar sua inscrição. Tente novamente.";
        try {
          const j = await res.json();
          if (typeof j.error === "string") message = j.error;
        } catch { /* mantém mensagem padrão */ }
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
        <h3 className="text-lg font-bold text-gray-900 mb-2 font-sora">Inscrição enviada!</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
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
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.10)]"
      noValidate
    >
      <h3 className="text-[17px] font-bold text-gray-900 mb-5 font-sora">
        Inscreva-se nesta vaga
      </h3>

      <div className="space-y-5">
        {/* Nome */}
        <div>
          <label htmlFor="fullName" className={labelClass}>
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

        {/* E-mail */}
        <div>
          <label htmlFor="email" className={labelClass}>
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

        {/* Celular */}
        <div>
          <label htmlFor="phone" className={labelClass}>
            Celular <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            placeholder="(11) 9 1234-5678"
            className={inputClass}
          />
        </div>

        {/* País de origem */}
        <div>
          <label htmlFor="country" className={labelClass}>
            País de origem <span className="text-red-500">*</span>
          </label>
          <select
            id="country"
            name="country"
            required
            defaultValue=""
            className={`${inputClass} cursor-pointer`}
          >
            <option value="" disabled>Selecione seu país</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Cidade (Brasil) */}
        <div>
          <label htmlFor="candidateCity" className={labelClass}>
            Cidade onde reside <span className="text-red-500">*</span>
          </label>
          <input
            id="candidateCity"
            name="candidateCity"
            type="text"
            list="ibge-cities"
            autoComplete="off"
            required
            onFocus={handleCityFocus}
            placeholder="Digite o nome da sua cidade"
            className={inputClass}
          />
          <datalist id="ibge-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {/* Disponibilidade presencial — só exibe quando a vaga tem cidade definida */}
        {jobCity && (
          <div>
            <p className={`${labelClass} mb-2`}>
              Você tem disponibilidade para trabalhar no modelo presencial em{" "}
              <span className="text-gray-900">{jobCity}</span>?{" "}
              <span className="text-red-500">*</span>
            </p>
            <div className="flex gap-5">
              <label className="flex items-center gap-2 cursor-pointer text-[15px] text-gray-800">
                <input
                  type="radio"
                  name="availablePresential"
                  value="true"
                  required
                  className="accent-wg-green w-4 h-4"
                />
                Sim
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[15px] text-gray-800">
                <input
                  type="radio"
                  name="availablePresential"
                  value="false"
                  className="accent-wg-green w-4 h-4"
                />
                Não
              </label>
            </div>
          </div>
        )}

        {/* Pretensão salarial */}
        <div>
          <label htmlFor="salaryDisplay" className={labelClass}>
            Pretensão salarial
          </label>
          <input
            id="salaryDisplay"
            type="text"
            inputMode="numeric"
            value={salaryDisplay}
            onChange={handleSalary}
            placeholder="R$ 0,00"
            className={inputClass}
          />
        </div>

        {/* Currículo */}
        <div>
          <label className={labelClass}>
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
            className="flex items-center gap-2.5 cursor-pointer border border-dashed border-gray-300 hover:border-wg-green rounded-lg px-4 py-3.5 text-[14px] text-gray-500 transition-colors"
          >
            {fileName ? (
              <>
                <Paperclip className="w-4 h-4 text-wg-green shrink-0" />
                <span className="truncate text-gray-900 font-medium">{fileName}</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 shrink-0" />
                <span>Anexar currículo (PDF, DOC ou DOCX — até {MAX_MB} MB)</span>
              </>
            )}
          </label>
        </div>

        <input type="hidden" name="termsVersion" value="1.0" />

        <label className="flex items-start gap-2.5 text-xs text-gray-600 leading-relaxed">
          <input
            type="checkbox"
            name="consent"
            value="true"
            required
            className="mt-0.5 accent-wg-green shrink-0"
          />
          <span>
            Li e concordo com os{" "}
            <a href="/termos" target="_blank" className="text-wg-green underline hover:text-wg-green-dark">
              Termos de Uso e Política de Cookies
            </a>{" "}
            e o{" "}
            <a href="/privacidade" target="_blank" className="text-wg-green underline hover:text-wg-green-dark">
              Aviso de Privacidade
            </a>{" "}
            da WG Baterias, incluindo o tratamento dos meus dados pessoais para fins de recrutamento.
          </span>
        </label>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-wg-green hover:bg-wg-green-bright disabled:opacity-60 text-black font-bold py-3.5 rounded-full transition-colors flex items-center justify-center gap-2 text-[15px]"
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
