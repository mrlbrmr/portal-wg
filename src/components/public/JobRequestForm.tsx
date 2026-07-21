"use client";

import { useState, useCallback } from "react";
import { Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import type { FormConfig, FormFieldConfig, ShowCondition } from "@/types/form-config";

interface Props {
  config: FormConfig;
}

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";

const labelClass = "block text-sm font-semibold text-gray-800 mb-1.5";

function evaluateCondition(condition: ShowCondition, values: Record<string, string>): boolean {
  const actual = (values[condition.fieldKey] ?? "").trim();
  if (condition.operator === "is") return actual === condition.value;
  if (condition.operator === "is_not") return actual !== condition.value;
  return true;
}

function isFieldVisible(field: FormFieldConfig, values: Record<string, string>): boolean {
  if (!field.showWhen) return true;
  return evaluateCondition(field.showWhen, values);
}

export function JobRequestForm({ config }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  function getVisibleFields(): FormFieldConfig[] {
    return config.fields.filter((f) => isFieldVisible(f, values));
  }

  function validateLocally(): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const field of getVisibleFields()) {
      if (field.required) {
        const val = (values[field.key] ?? "").trim();
        if (!val) errs[field.key] = `${field.label} é obrigatório`;
      }
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    const localErrors = validateLocally();
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    // Only submit visible fields
    const visibleKeys = new Set(getVisibleFields().map((f) => f.key));
    const formData: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (visibleKeys.has(k) && v.trim()) formData[k] = v;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/job-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.fieldErrors) {
          setErrors(body.fieldErrors);
        } else {
          setGeneralError(body?.error ?? "Erro ao enviar solicitação. Tente novamente.");
        }
        return;
      }

      setDone(true);
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
        <p className="text-gray-500 text-sm max-w-sm">
          O time de Gente &amp; Gestão recebeu sua solicitação e entrará em contato em breve.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {config.fields.map((field) => {
        const visible = isFieldVisible(field, values);
        return (
          <div
            key={field.id}
            className={
              visible
                ? "transition-all duration-300 opacity-100 max-h-[500px]"
                : "transition-all duration-300 opacity-0 max-h-0 overflow-hidden pointer-events-none"
            }
            aria-hidden={!visible}
          >
            <FieldRenderer
              field={field}
              value={values[field.key] ?? ""}
              onChange={(v) => handleChange(field.key, v)}
              error={errors[field.key]}
            />
          </div>
        );
      })}

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
          <>Enviar &rarr;</>
        )}
      </button>
    </form>
  );
}

interface FieldRendererProps {
  field: FormFieldConfig;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}

function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
  return (
    <div>
      <label htmlFor={field.key} className={labelClass}>
        {field.label}
        {field.required ? (
          <span className="text-red-500 ml-0.5">*</span>
        ) : (
          <span className="text-gray-400 font-normal text-xs ml-1">(não é obrigatório)</span>
        )}
      </label>

      {field.type === "select" ? (
        <div className="relative">
          <select
            id={field.key}
            name={field.key}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} appearance-none pr-10 cursor-pointer`}
          >
            <option value=""></option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      ) : field.type === "textarea" ? (
        <textarea
          id={field.key}
          name={field.key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          id={field.key}
          name={field.key}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
