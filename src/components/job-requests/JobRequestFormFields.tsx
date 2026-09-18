"use client";

// Campos da SOLICITAÇÃO DE VAGA — usados tanto no formulário público (/solicitar-vaga)
// quanto nas telas internas (nova solicitação e edição).
//
// A ordem das seções é a da tela especificada: Dados da solicitação → Motivo da
// contratação → Condições da vaga → Perguntas complementares. Nada de campo operacional
// de recrutamento aqui (publicar, banco de talentos, ocultar salário, data de
// encerramento): isso é decisão da VAGA, depois da aprovação.

import { useCallback, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { FormFieldConfig, ShowCondition } from "@/types/form-config";
import type { ContractType, JobRequestReason, Modality } from "@/types/domain";
import {
  CONTRACT_TYPE_LABELS,
  CONTRACT_TYPE_ORDER,
  JOB_REQUEST_REASON_LABELS,
  JOB_REQUEST_REASON_ORDER,
  MODALITY_LABELS,
  MODALITY_ORDER,
  requiresReplacedEmployee,
} from "@/lib/job-requests/constants";

export interface JobRequestFormValues {
  title: string;
  department: string;
  location: string;
  requesterName: string;
  requesterEmail: string;
  openings: string;
  reasonType: JobRequestReason;
  replacedEmployee: string;
  justification: string;
  desiredStartDate: string;
  contractType: ContractType;
  modality: Modality;
  workSchedule: string;
  extraData: Record<string, string>;
}

export const EMPTY_JOB_REQUEST_FORM: JobRequestFormValues = {
  title: "",
  department: "",
  location: "",
  requesterName: "",
  requesterEmail: "",
  openings: "1",
  reasonType: "REPLACEMENT",
  replacedEmployee: "",
  justification: "",
  desiredStartDate: "",
  contractType: "CLT",
  modality: "PRESENTIAL",
  workSchedule: "",
  extraData: {},
};

/** Converte o estado do formulário no payload que o schema zod espera. */
export function toPayload(v: JobRequestFormValues) {
  return {
    title: v.title.trim(),
    department: v.department.trim(),
    location: v.location.trim(),
    requesterName: v.requesterName.trim(),
    requesterEmail: v.requesterEmail.trim(),
    openings: Number(v.openings) || 0,
    reasonType: v.reasonType,
    replacedEmployee: v.replacedEmployee.trim() || null,
    justification: v.justification.trim(),
    desiredStartDate: v.desiredStartDate,
    contractType: v.contractType,
    modality: v.modality,
    workSchedule: v.workSchedule.trim() || null,
    extraData: v.extraData,
  };
}

// ─── Estilos (os mesmos já usados nos formulários do painel) ─────────────────

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";
const labelClass = "block text-sm font-semibold text-gray-800 mb-1.5";
const sectionTitle =
  "text-xs font-bold text-[#8A9480] uppercase tracking-wider font-sora";

function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none pr-10 cursor-pointer`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="border-b border-[#E7EEDD] pb-2">
        <p className={sectionTitle}>{title}</p>
        {subtitle && <p className="text-xs text-[#55614A] mt-1 font-normal normal-case">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

// ─── Perguntas complementares (formulário configurável) ──────────────────────

function evaluateCondition(c: ShowCondition, values: Record<string, string>): boolean {
  const actual = (values[c.fieldKey] ?? "").trim();
  if (c.operator === "is") return actual === c.value;
  if (c.operator === "is_not") return actual !== c.value;
  return true;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export interface Props {
  values: JobRequestFormValues;
  onChange: (patch: Partial<JobRequestFormValues>) => void;
  errors?: Record<string, string>;
  /** Perguntas extras configuradas pelo RH. */
  extraFields?: FormFieldConfig[];
  /** Sugestões de Empresa/Unidade e Área já usadas no sistema. */
  unitOptions?: string[];
  departmentOptions?: string[];
  /** Trava o gestor requisitante (preenchido pela sessão). */
  lockRequester?: boolean;
  /** Campos críticos ficam sinalizados quando a solicitação já foi aprovada. */
  criticalHighlight?: boolean;
}

export function JobRequestFormFields({
  values,
  onChange,
  errors = {},
  extraFields = [],
  unitOptions = [],
  departmentOptions = [],
  lockRequester = false,
  criticalHighlight = false,
}: Props) {
  const setExtra = useCallback(
    (key: string, value: string) =>
      onChange({ extraData: { ...values.extraData, [key]: value } }),
    [onChange, values.extraData]
  );

  const showReplaced = requiresReplacedEmployee(values.reasonType);
  const criticalMark = criticalHighlight ? (
    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-[#8A5B10]">
      exige nova aprovação
    </span>
  ) : null;

  return (
    <div className="space-y-8">
      {/* ── Dados da solicitação ─────────────────────────────────────────── */}
      <Section title="Dados da solicitação">
        <div className="grid md:grid-cols-2 gap-4">
          <Field
            label="Título da vaga"
            htmlFor="jr-title"
            required
            error={errors.title}
            className="md:col-span-2"
          >
            <>
              <input
                id="jr-title"
                type="text"
                value={values.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="Ex: Auxiliar de Estoque"
                className={inputClass}
              />
              {criticalMark}
            </>
          </Field>

          <Field label="Área / Departamento" htmlFor="jr-department" required error={errors.department}>
            <input
              id="jr-department"
              type="text"
              list="jr-department-options"
              value={values.department}
              onChange={(e) => onChange({ department: e.target.value })}
              placeholder="Ex: Logística, Comercial, Financeiro"
              className={inputClass}
            />
            <datalist id="jr-department-options">
              {departmentOptions.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Field>

          <Field label="Empresa / Unidade" htmlFor="jr-location" required error={errors.location}>
            <input
              id="jr-location"
              type="text"
              list="jr-unit-options"
              value={values.location}
              onChange={(e) => onChange({ location: e.target.value })}
              placeholder="Ex: WG Baterias — Matriz"
              className={inputClass}
            />
            <datalist id="jr-unit-options">
              {unitOptions.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>

          <Field
            label="Gestor requisitante"
            htmlFor="jr-requester"
            required
            error={errors.requesterName}
            hint={lockRequester ? "Preenchido com o usuário conectado." : undefined}
          >
            <input
              id="jr-requester"
              type="text"
              value={values.requesterName}
              onChange={(e) => onChange({ requesterName: e.target.value })}
              readOnly={lockRequester}
              placeholder="Nome completo de quem está pedindo"
              className={`${inputClass} ${lockRequester ? "bg-gray-50 text-gray-500" : ""}`}
            />
          </Field>

          <Field label="E-mail do gestor" htmlFor="jr-email" required error={errors.requesterEmail}>
            <input
              id="jr-email"
              type="email"
              value={values.requesterEmail}
              onChange={(e) => onChange({ requesterEmail: e.target.value })}
              readOnly={lockRequester}
              placeholder="nome@wgbaterias.com.br"
              className={`${inputClass} ${lockRequester ? "bg-gray-50 text-gray-500" : ""}`}
            />
          </Field>

          <Field label="Quantidade de vagas" htmlFor="jr-openings" required error={errors.openings}>
            <>
              <input
                id="jr-openings"
                type="number"
                min={1}
                max={999}
                inputMode="numeric"
                value={values.openings}
                onChange={(e) => onChange({ openings: e.target.value })}
                className={inputClass}
              />
              {criticalMark}
            </>
          </Field>
        </div>
      </Section>

      {/* ── Motivo da contratação ────────────────────────────────────────── */}
      <Section title="Motivo da contratação">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Motivo da abertura" htmlFor="jr-reason" required error={errors.reasonType}>
            <>
              <Select
                id="jr-reason"
                value={values.reasonType}
                onChange={(v) => onChange({ reasonType: v as JobRequestReason })}
              >
                {JOB_REQUEST_REASON_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {JOB_REQUEST_REASON_LABELS[r]}
                  </option>
                ))}
              </Select>
              {criticalMark}
            </>
          </Field>

          {/* Condicional: só "Substituição" pede o colaborador substituído. */}
          <div
            className={
              showReplaced
                ? "transition-all duration-200 opacity-100"
                : "transition-all duration-200 opacity-0 max-h-0 overflow-hidden pointer-events-none"
            }
            aria-hidden={!showReplaced}
          >
            <Field
              label="Colaborador substituído"
              htmlFor="jr-replaced"
              required
              error={errors.replacedEmployee}
            >
              <input
                id="jr-replaced"
                type="text"
                value={values.replacedEmployee}
                onChange={(e) => onChange({ replacedEmployee: e.target.value })}
                placeholder="Nome completo de quem está saindo"
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label="Justificativa da contratação"
            htmlFor="jr-justification"
            required
            error={errors.justification}
            className="md:col-span-2"
            hint="Explique o impacto de não contratar e o que a posição resolve."
          >
            <textarea
              id="jr-justification"
              rows={4}
              value={values.justification}
              onChange={(e) => onChange({ justification: e.target.value })}
              className={`${inputClass} resize-y`}
            />
          </Field>

          <Field
            label="Data desejada para admissão"
            htmlFor="jr-start"
            required
            error={errors.desiredStartDate}
          >
            <input
              id="jr-start"
              type="date"
              value={values.desiredStartDate}
              onChange={(e) => onChange({ desiredStartDate: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      {/* ── Condições da vaga ────────────────────────────────────────────── */}
      <Section title="Condições da vaga">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Tipo de contratação" htmlFor="jr-contract" required error={errors.contractType}>
            <>
              <Select
                id="jr-contract"
                value={values.contractType}
                onChange={(v) => onChange({ contractType: v as ContractType })}
              >
                {CONTRACT_TYPE_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {CONTRACT_TYPE_LABELS[c]}
                  </option>
                ))}
              </Select>
              {criticalMark}
            </>
          </Field>

          <Field label="Modalidade" htmlFor="jr-modality" required error={errors.modality}>
            <Select
              id="jr-modality"
              value={values.modality}
              onChange={(v) => onChange({ modality: v as Modality })}
            >
              {MODALITY_ORDER.map((m) => (
                <option key={m} value={m}>
                  {MODALITY_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Horário / Jornada de trabalho"
            htmlFor="jr-schedule"
            error={errors.workSchedule}
            className="md:col-span-2"
          >
            <input
              id="jr-schedule"
              type="text"
              value={values.workSchedule}
              onChange={(e) => onChange({ workSchedule: e.target.value })}
              placeholder="Ex: Seg a Sex, 08h–17h"
              className={inputClass}
            />
          </Field>

          {/*
            Faixa salarial, centro de custo e previsão de orçamento NÃO são pedidos ao
            gestor: a WG não usa centro de custo, o salário é definido pelo RH direto na
            vaga e o headcount é controlado fora do sistema.
          */}
        </div>
      </Section>

      {/* ── Perguntas complementares (configuráveis pelo RH) ─────────────── */}
      {extraFields.length > 0 && (
        <Section
          title="Informações complementares"
          subtitle="Perguntas configuradas pelo time de Gente & Gestão."
        >
          <div className="grid md:grid-cols-2 gap-4">
            {extraFields.map((field) => {
              const visible = !field.showWhen || evaluateCondition(field.showWhen, values.extraData);
              if (!visible) return null;
              const value = values.extraData[field.key] ?? "";
              return (
                <Field
                  key={field.id}
                  label={field.label}
                  htmlFor={`jr-extra-${field.key}`}
                  required={field.required}
                  error={errors[field.key]}
                  className={field.type === "textarea" ? "md:col-span-2" : ""}
                >
                  {field.type === "select" ? (
                    <Select
                      id={`jr-extra-${field.key}`}
                      value={value}
                      onChange={(v) => setExtra(field.key, v)}
                    >
                      <option value="" />
                      {(field.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      id={`jr-extra-${field.key}`}
                      rows={3}
                      value={value}
                      onChange={(e) => setExtra(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={`${inputClass} resize-y`}
                    />
                  ) : (
                    <input
                      id={`jr-extra-${field.key}`}
                      type={
                        field.type === "email"
                          ? "email"
                          : field.type === "number"
                            ? "number"
                            : field.type === "date"
                              ? "date"
                              : "text"
                      }
                      value={value}
                      onChange={(e) => setExtra(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={inputClass}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
