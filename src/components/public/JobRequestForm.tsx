"use client";

// Formulário de SOLICITAÇÃO DE VAGA preenchido pelo gestor.
//
// O que ele preenche é a NECESSIDADE DE CONTRATAÇÃO — não a vaga. A vaga (processo
// seletivo) só é aberta pelo RH depois que a solicitação for validada e aprovada.

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  EMPTY_JOB_REQUEST_FORM,
  JobRequestFormFields,
  toPayload,
  type JobRequestFormValues,
} from "@/components/job-requests/JobRequestFormFields";
import type { FormConfig } from "@/types/form-config";

interface Props {
  config: FormConfig;
  unitOptions?: string[];
  departmentOptions?: string[];
  /** Quando o gestor está logado, o requisitante já vem preenchido e travado. */
  currentUser?: { name: string | null; email: string | null } | null;
}

export function JobRequestForm({
  config,
  unitOptions = [],
  departmentOptions = [],
  currentUser = null,
}: Props) {
  const [values, setValues] = useState<JobRequestFormValues>(() => ({
    ...EMPTY_JOB_REQUEST_FORM,
    requesterName: currentUser?.name ?? "",
    requesterEmail: currentUser?.email ?? "",
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState<{ code: string | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [errorTick, setErrorTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // O aviso geral fica ao lado do botão, no fim do formulário; em celular o campo com
  // problema costuma estar fora da tela e o gestor achava que tinha enviado. Leva a tela
  // até o primeiro campo com erro e foca nele.
  useEffect(() => {
    if (errorTick === 0) return;
    const firstError = formRef.current?.querySelector("[data-field-error]");
    const field = firstError?.parentElement;
    if (!field) return;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
  }, [errorTick]);

  const patch = useCallback((p: Partial<JobRequestFormValues>) => {
    setValues((prev) => ({ ...prev, ...p }));
    setErrors((prev) => {
      const keys = Object.keys(p);
      if (!keys.some((k) => prev[k])) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/job-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(values)),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          fieldErrors?: Record<string, string | string[]>;
          error?: string;
        };
        if (body?.fieldErrors) {
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(body.fieldErrors)) {
            flat[k] = Array.isArray(v) ? v[0] : v;
          }
          setErrors(flat);
          setErrorTick((t) => t + 1);
          const n = Object.keys(flat).length;
          setGeneralError(
            `A solicitação NÃO foi enviada: ${n === 1 ? "1 campo precisa" : `${n} campos precisam`} de ajuste (destacados em vermelho).`
          );
        } else {
          setGeneralError(body?.error ?? "Erro ao enviar a solicitação. Tente novamente.");
        }
        return;
      }

      const body = (await res.json()) as { requestCode?: string | null };
      setDone({ code: body.requestCode ?? null });
    } catch {
      setGeneralError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="w-14 h-14 text-wg-green mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Solicitação enviada!</h2>
        {done.code && (
          <p className="text-sm font-bold text-[#4F6930] mb-2">Número: {done.code}</p>
        )}
        <p className="text-gray-500 text-sm max-w-md">
          O time de Gente &amp; Gestão vai validar sua solicitação e encaminhá-la para
          aprovação. Você receberá um e-mail a cada etapa — a vaga só é aberta depois
          que a contratação for aprovada.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-8">
      <JobRequestFormFields
        values={values}
        onChange={patch}
        errors={errors}
        extraFields={config.fields}
        unitOptions={unitOptions}
        departmentOptions={departmentOptions}
        lockRequester={Boolean(currentUser?.name && currentUser?.email)}
      />

      {generalError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {generalError}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>Enviar solicitação &rarr;</>
        )}
      </button>
    </form>
  );
}
