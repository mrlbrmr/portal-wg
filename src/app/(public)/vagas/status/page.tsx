"use client";

import { useState } from "react";
import { Loader2, Search, CheckCircle2, Clock, XCircle, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { maskCpf, formatDate } from "@/lib/utils";

interface ApplicationStatus {
  jobTitle: string;
  jobCity: string | null;
  appliedAt: string;
  stageLabel: string;
  stageKind: "OPEN" | "WON" | "LOST";
}

interface StatusResult {
  found: boolean;
  candidateName?: string;
  applications?: ApplicationStatus[];
  error?: string;
}

const inputClass =
  "w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/30 focus:border-wg-green transition-colors";

const labelClass = "block text-[13.5px] font-semibold text-gray-700 mb-1.5";

function StageChip({ kind, label }: { kind: "OPEN" | "WON" | "LOST"; label: string }) {
  if (kind === "WON") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 text-xs font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  }
  if (kind === "LOST") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-3 py-1 text-xs font-semibold">
        <XCircle className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs font-semibold">
      <Clock className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

export default function StatusPage() {
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StatusResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/candidatura/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf, email }),
      });

      if (res.status === 429) {
        setResult({ found: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
        return;
      }

      const data: StatusResult = await res.json();
      setResult(data);
    } catch {
      setResult({ found: false, error: "Erro de conexão. Verifique sua internet e tente novamente." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-[640px] mx-auto px-4 py-10 md:py-16">

        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-wg-green hover:text-wg-green-bright transition-colors mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar às vagas
        </Link>

        <h1 className="text-[28px] font-extrabold text-gray-900 mb-2 font-sora">
          Status da candidatura
        </h1>
        <p className="text-gray-500 text-[15px] mb-8">
          Informe seu CPF e e-mail para consultar o andamento das suas candidaturas ao Grupo WG.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5"
        >
          <div>
            <label htmlFor="cpf-status" className={labelClass}>
              CPF <span className="text-red-500">*</span>
            </label>
            <input
              id="cpf-status"
              type="text"
              inputMode="numeric"
              required
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="email-status" className={labelClass}>
              E-mail cadastrado <span className="text-red-500">*</span>
            </label>
            <input
              id="email-status"
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              placeholder="seunome@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          {result?.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {result.error}
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
                Consultando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Consultar candidatura
              </>
            )}
          </button>
        </form>

        {/* Resultado da busca */}
        {result && !result.error && (
          <div className="mt-8">
            {!result.found ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
                <p className="text-gray-500 text-[15px]">
                  Nenhuma candidatura encontrada para esse CPF e e-mail.
                </p>
                <p className="text-gray-400 text-[13px] mt-2">
                  Verifique se os dados estão iguais aos informados na inscrição.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[15px] font-semibold text-gray-800">
                  Olá, {result.candidateName}! Encontramos{" "}
                  {result.applications?.length === 1
                    ? "1 candidatura"
                    : `${result.applications?.length} candidaturas`}
                  .
                </p>
                {result.applications?.map((app, i) => (
                  <div
                    key={i}
                    className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-gray-900 truncate">
                          {app.jobTitle}
                        </p>
                        {app.jobCity && (
                          <p className="text-[13px] text-gray-400 mt-0.5">{app.jobCity}</p>
                        )}
                        <p className="text-[12px] text-gray-400 mt-1">
                          Inscrito em {formatDate(app.appliedAt)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <StageChip kind={app.stageKind} label={app.stageLabel} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
