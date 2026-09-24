"use client";

// Campos do formulário da vaga — compartilhados entre "Nova vaga" e a página da vaga.
// Controlados (estado no pai): a página da vaga distribui os campos em abas e precisa
// saber o que mudou (estado sujo + aviso de alteração de escopo aprovado).

import { useId, type ReactNode } from "react";
import { BadgeCheck, Eye, Pencil } from "lucide-react";
import { cn, BRAZIL_STATES, JOB_VISIBILITY_LABELS } from "@/lib/utils";
import { JOB_REQUEST_REASON_LABELS, JOB_REQUEST_REASON_ORDER } from "@/lib/job-requests/constants";
import { JOB_STATUS_OPTION_GROUPS } from "@/lib/recruitment/job-presentation";
import { buildInitialContent, markdownToHtml } from "@/lib/jobs/markdown";
import { formatBRL, salaryColumns, salaryStateFromJob, type SalaryMode } from "@/lib/jobs/salary";
import { dateInputValue } from "@/lib/jobs/deadlines";
import type { Job, JobVisibility } from "@/types/domain";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

export const inputClass =
  "w-full h-9 rounded-control border border-wg-border-light bg-white px-3 text-sm text-wg-ink placeholder:text-wg-ink-muted/70 transition-colors hover:border-[#C9D9B4] focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30 disabled:cursor-not-allowed disabled:bg-wg-bg disabled:text-wg-ink-muted";

// ─── Rascunho da vaga (estado do formulário) ────────────────────────────────────────────

export interface JobDraft {
  title: string;
  isTalentPool: boolean;
  department: string;
  company: string;
  city: string;
  state: string;
  modality: string;
  contractType: string;
  workSchedule: string;
  openingReason: string;
  salaryMode: SalaryMode;
  /** Dígitos do valor em centavos ("280000" = R$ 2.800,00). */
  salaryDigits: string;
  salaryPublic: boolean;
  /** Texto salarial antigo sem valor numérico (só leitura; preservado se nada for informado). */
  salaryLegacyText: string | null;
  status: string;
  /** Onde a vaga aparece: Portal, Intranet ou os dois. */
  visibility: JobVisibility;
  responsible: string;
  hiringManager: string;
  closingDate: string;
  hiringDeadline: string;
  content: string;
}

/** Rascunho inicial: da vaga existente, ou vazio para "Nova vaga". */
export function jobToDraft(job: Job | null | undefined, defaults: { responsible?: string | null } = {}): JobDraft {
  const salary = job ? salaryStateFromJob(job) : null;
  return {
    title: job?.title ?? "",
    isTalentPool: job?.isTalentPool ?? false,
    department: job?.department ?? "",
    company: job?.company ?? "",
    city: job?.city ?? "",
    state: job?.state ?? (job ? "" : "SP"),
    modality: job?.modality ?? "PRESENTIAL",
    contractType: job?.contractType ?? "CLT",
    workSchedule: job?.workSchedule ?? "",
    openingReason: job?.openingReason ?? "",
    salaryMode: salary?.mode ?? "DEFINED",
    salaryDigits: salary?.salary != null ? String(Math.round(salary.salary * 100)) : "",
    salaryPublic: salary?.salaryPublic ?? true,
    salaryLegacyText: salary?.legacyText ?? null,
    status: job?.status ?? "DRAFT",
    visibility: job?.visibility ?? "BOTH",
    responsible: job?.responsible ?? defaults.responsible ?? "",
    hiringManager: job?.hiringManager ?? "",
    closingDate: dateInputValue(job?.closingDate as string | Date | null | undefined),
    hiringDeadline: dateInputValue(job?.hiringDeadline as string | Date | null | undefined),
    content: buildInitialContent(job ?? undefined),
  };
}

export function salaryValue(d: Pick<JobDraft, "salaryDigits">): number | null {
  return d.salaryDigits ? parseInt(d.salaryDigits, 10) / 100 : null;
}

/** Corpo do POST/PATCH a partir do rascunho (mesmo formato nas duas rotas). */
export function draftToPayload(d: JobDraft) {
  return {
    title: d.title.trim(),
    department: d.department.trim() || null,
    company: d.company.trim() || null,
    isTalentPool: d.isTalentPool,
    city: d.isTalentPool ? null : d.city.trim(),
    state: d.isTalentPool ? null : d.state,
    modality: d.modality,
    contractType: d.contractType,
    description: markdownToHtml(d.content),
    responsibilities: null,
    requiredRequirements: null,
    desiredRequirements: null,
    benefits: null,
    workSchedule: d.workSchedule.trim() || null,
    salaryMode: d.salaryMode,
    salary: d.salaryMode === "DEFINED" ? salaryValue(d) : null,
    salaryPublic: d.salaryPublic,
    closingDate: d.closingDate || null,
    hiringDeadline: d.hiringDeadline || null,
    responsible: d.responsible.trim() || null,
    hiringManager: d.hiringManager.trim() || null,
    openingReason: d.openingReason || null,
    status: d.status,
    visibility: d.visibility,
  };
}

/** Validação mínima antes de enviar (o servidor valida de novo). */
export function validateDraft(d: JobDraft): string | null {
  if (d.title.trim().length < 2) return "Informe o título da vaga.";
  if (!d.isTalentPool && d.city.trim().length < 2) return "Informe a cidade da vaga.";
  if (!d.isTalentPool && !d.state) return "Informe a UF da vaga.";
  if (d.content.trim().length < 10) return 'O "Conteúdo da vaga" é obrigatório (mínimo 10 caracteres).';
  if (d.salaryMode === "DEFINED" && d.salaryDigits && salaryValue(d) === 0) return "Informe um salário maior que zero.";
  return null;
}

// ─── Blocos de apresentação ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  /** Campo faz parte do escopo aprovado na solicitação. */
  approved?: boolean;
  /** "Originalmente aprovado: X" — só quando diverge. */
  approvedHint?: string | null;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, required, hint, approved, approvedHint, className, children }: FieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 flex items-center gap-1.5">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-wg-ink-secondary">
          {label}
          {required && <span className="text-danger-fg"> *</span>}
        </label>
        {approved && (
          <span
            title="Definido na solicitação aprovada"
            className="inline-flex items-center gap-0.5 rounded-full bg-success-bg px-1.5 py-px text-[10.5px] font-semibold text-success-fg"
          >
            <BadgeCheck className="h-3 w-3" aria-hidden />
            Aprovado
          </span>
        )}
      </div>
      {children}
      {approvedHint && <p className="mt-1 text-[12px] font-medium text-warning-fg">{approvedHint}</p>}
      {hint && !approvedHint && <p className="mt-1 text-[12px] text-wg-ink-muted">{hint}</p>}
    </div>
  );
}

/** Radio em formato de cartão (Tipo de oportunidade, Salário). */
export function ChoiceCards<T extends string>({
  name,
  value,
  onChange,
  options,
  label,
  columns = 2,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  label: string;
  options: Array<{ value: T; label: string; description?: string; disabled?: boolean; disabledReason?: string }>;
  columns?: 2 | 3;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3")}>
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <label
            key={o.value}
            title={o.disabled ? o.disabledReason : undefined}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-control border px-3 py-2.5 transition-colors",
              checked ? "border-wg-green bg-wg-sidebar/60" : "border-wg-border-light bg-white hover:bg-wg-bg",
              o.disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="mt-0.5 h-4 w-4 accent-wg-green"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-wg-ink">{o.label}</span>
              {o.description && <span className="block text-[12px] text-wg-ink-muted">{o.description}</span>}
              {o.disabled && o.disabledReason && (
                <span className="mt-0.5 block text-[12px] text-warning-fg">{o.disabledReason}</span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function maskBRL(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 12);
  if (!d) return "";
  return formatBRL(parseInt(d, 10) / 100);
}

type Patch = (p: Partial<JobDraft>) => void;

// ─── Seções ─────────────────────────────────────────────────────────────────────────────

export function OpportunityFields({
  draft,
  patch,
  approved,
  hints,
  talentPoolDisabledReason,
}: {
  draft: JobDraft;
  patch: Patch;
  approved?: Set<string>;
  hints?: Partial<Record<string, string | null>>;
  /** Motivo para não permitir virar banco de talentos (ex.: posições preenchidas). */
  talentPoolDisabledReason?: string | null;
}) {
  const id = useId();
  const a = (f: string) => approved?.has(f) ?? false;
  return (
    <div className="space-y-4">
      <Field label="Tipo de oportunidade">
        <ChoiceCards
          name={`${id}-type`}
          label="Tipo de oportunidade"
          value={draft.isTalentPool ? "POOL" : "SPECIFIC"}
          onChange={(v) => patch({ isTalentPool: v === "POOL" })}
          options={[
            { value: "SPECIFIC", label: "Vaga específica", description: "Contratação com posições, local e prazo definidos." },
            {
              value: "POOL",
              label: "Banco de talentos",
              description: "Coleta contínua de currículos, sem posições nem cidade fixa.",
              disabled: !draft.isTalentPool && Boolean(talentPoolDisabledReason),
              disabledReason: talentPoolDisabledReason ?? undefined,
            },
          ]}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título da vaga" htmlFor={`${id}-title`} required approved={a("title")} approvedHint={hints?.title} className="sm:col-span-2">
          <input id={`${id}-title`} value={draft.title} onChange={(e) => patch({ title: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Área / departamento" htmlFor={`${id}-dep`} approved={a("department")} approvedHint={hints?.department}>
          <input id={`${id}-dep`} value={draft.department} onChange={(e) => patch({ department: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Empresa / unidade" htmlFor={`${id}-co`} approved={a("company")} approvedHint={hints?.company}>
          <input
            id={`${id}-co`}
            value={draft.company}
            onChange={(e) => patch({ company: e.target.value })}
            placeholder="Ex.: WG Baterias SP"
            className={inputClass}
          />
        </Field>
        {!draft.isTalentPool && (
          <>
            <Field label="Cidade" htmlFor={`${id}-city`} required>
              <input id={`${id}-city`} value={draft.city} onChange={(e) => patch({ city: e.target.value })} className={inputClass} />
            </Field>
            <Field label="UF" htmlFor={`${id}-uf`} required>
              <select id={`${id}-uf`} value={draft.state} onChange={(e) => patch({ state: e.target.value })} className={inputClass}>
                <option value="">Selecione</option>
                {BRAZIL_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field label="Modalidade" htmlFor={`${id}-mod`} required approved={a("modality")} approvedHint={hints?.modality}>
          <select id={`${id}-mod`} value={draft.modality} onChange={(e) => patch({ modality: e.target.value })} className={inputClass}>
            <option value="PRESENTIAL">Presencial</option>
            <option value="REMOTE">Remoto</option>
            <option value="HYBRID">Híbrido</option>
          </select>
        </Field>
        <Field label="Tipo de contratação" htmlFor={`${id}-ct`} required approved={a("contractType")} approvedHint={hints?.contractType}>
          <select id={`${id}-ct`} value={draft.contractType} onChange={(e) => patch({ contractType: e.target.value })} className={inputClass}>
            <option value="CLT">CLT</option>
            <option value="PJ">PJ</option>
            <option value="INTERNSHIP">Estágio</option>
            <option value="APPRENTICE">Jovem Aprendiz</option>
            <option value="TEMPORARY">Temporário</option>
            <option value="OTHER">Outro</option>
          </select>
        </Field>
        <Field label="Horário de trabalho" htmlFor={`${id}-ws`}>
          <input
            id={`${id}-ws`}
            value={draft.workSchedule}
            onChange={(e) => patch({ workSchedule: e.target.value })}
            placeholder="Ex.: Seg a Sex, 08h–17h"
            className={inputClass}
          />
        </Field>
        <Field label="Motivo da abertura" htmlFor={`${id}-reason`} approved={a("openingReason")} approvedHint={hints?.openingReason}>
          <select id={`${id}-reason`} value={draft.openingReason} onChange={(e) => patch({ openingReason: e.target.value })} className={inputClass}>
            <option value="">Não informado</option>
            {JOB_REQUEST_REASON_ORDER.map((r) => (
              <option key={r} value={r}>
                {JOB_REQUEST_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

export function SalaryFields({ draft, patch, approvedLabel }: { draft: JobDraft; patch: Patch; approvedLabel?: string | null }) {
  const id = useId();
  const cols = salaryColumns({
    mode: draft.salaryMode,
    salary: salaryValue(draft),
    salaryPublic: draft.salaryPublic,
    legacyText: draft.salaryLegacyText,
  });
  return (
    <div className="space-y-4">
      <Field label="Salário">
        <ChoiceCards
          name={`${id}-mode`}
          label="Salário"
          value={draft.salaryMode}
          onChange={(v) => patch({ salaryMode: v })}
          options={[
            { value: "DEFINED", label: "Valor definido", description: "O RH registra o salário da vaga." },
            { value: "TO_AGREE", label: "A combinar", description: "Sem valor fechado — negociado com o candidato." },
          ]}
        />
      </Field>
      {draft.salaryMode === "DEFINED" && (
        <Field
          label="Valor mensal"
          htmlFor={`${id}-value`}
          hint={
            draft.salaryLegacyText && !draft.salaryDigits
              ? `Texto publicado hoje: "${draft.salaryLegacyText}". Informe o valor para substituí-lo.`
              : approvedLabel
                ? `Faixa aprovada na solicitação: ${approvedLabel}`
                : "Valor interno de referência da vaga."
          }
          className="max-w-xs"
        >
          <input
            id={`${id}-value`}
            inputMode="numeric"
            value={maskBRL(draft.salaryDigits)}
            onChange={(e) => patch({ salaryDigits: e.target.value.replace(/\D/g, "").slice(0, 12) })}
            placeholder="R$ 0,00"
            className={inputClass}
          />
        </Field>
      )}
      <div className="rounded-control border border-wg-border-lighter bg-wg-bg px-3 py-2.5">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={!draft.salaryPublic}
            onChange={(e) => patch({ salaryPublic: !e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-wg-green"
          />
          <span>
            <span className="block text-sm font-medium text-wg-ink">Não divulgar salário no portal</span>
            <span className="block text-[12px] text-wg-ink-muted">
              O valor continua registrado internamente. No portal:{" "}
              <strong className="font-semibold text-wg-ink-secondary">{cols.salaryRange ?? "salário não exibido"}</strong>
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

const VISIBILITY_OPTIONS: Array<{ value: JobVisibility; description: string }> = [
  { value: "BOTH", description: "Aparece para candidatos e para colaboradores em Vagas Internas." },
  { value: "PUBLIC", description: "Só candidatos externos veem. Não aparece na Intranet." },
  {
    value: "INTERNAL",
    description: "Só colaboradores veem, na Intranet. Fora da lista do portal, do Google e do Indeed.",
  },
];

/** Onde a vaga aparece. O status continua decidindo se ela está aberta. */
export function VisibilityField({ draft, patch }: { draft: JobDraft; patch: Patch }) {
  const id = useId();
  return (
    <Field label="Onde esta vaga deve ser exibida?" hint="A vaga só aparece enquanto o status estiver aberto e as inscrições no prazo.">
      <ChoiceCards
        name={`${id}-visibility`}
        label="Onde esta vaga deve ser exibida?"
        value={draft.visibility}
        onChange={(v) => patch({ visibility: v })}
        columns={3}
        options={VISIBILITY_OPTIONS.map((o) => ({ ...o, label: JOB_VISIBILITY_LABELS[o.value] }))}
      />
    </Field>
  );
}

export function StatusSelect({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {JOB_STATUS_OPTION_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} — {o.hint}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export const markdownPreviewClass =
  "text-sm text-wg-ink [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3:first-child]:mt-0 [&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold [&_em]:italic [&_code]:rounded [&_code]:bg-wg-bg [&_code]:px-1 [&_code]:text-xs";

export function MarkdownEditor({
  value,
  onChange,
  mode,
  onModeChange,
  rows = 18,
}: {
  value: string;
  onChange: (v: string) => void;
  mode: "write" | "preview";
  onModeChange: (m: "write" | "preview") => void;
  rows?: number;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="Modo do editor"
          value={mode}
          onChange={onModeChange}
          options={[
            { value: "write", label: "Escrever", icon: Pencil },
            { value: "preview", label: "Visualizar", icon: Eye },
          ]}
        />
        <p className="text-[12px] text-wg-ink-muted">
          Markdown: <code className="rounded bg-wg-bg px-1">### Título</code> <code className="rounded bg-wg-bg px-1">- item</code>{" "}
          <code className="rounded bg-wg-bg px-1">**negrito**</code>
        </p>
      </div>
      {mode === "write" ? (
        <textarea
          aria-label="Conteúdo da vaga"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder="Use Markdown para estruturar a vaga…"
          className="w-full resize-y rounded-control border border-wg-border-light bg-white px-3 py-2.5 font-mono text-[13px] leading-relaxed text-wg-ink placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30"
        />
      ) : (
        <div
          className={cn("min-h-[320px] rounded-control border border-wg-border-light bg-white px-4 py-3", markdownPreviewClass)}
          dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }}
        />
      )}
    </div>
  );
}
