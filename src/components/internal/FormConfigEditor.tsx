"use client";

// Editor do formulário de SOLICITAÇÃO DE VAGA (Configurações › Solicitação de vaga).
// Campos padrão são estruturais (colunas de job_requests) e só aparecem para consulta;
// o RH edita a apresentação e os CAMPOS ADICIONAIS (→ job_requests.extra_data).

import { useMemo, useState } from "react";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Hash,
  ListChecks,
  ListOrdered,
  Lock,
  Mail,
  MoreHorizontal,
  Plus,
  ToggleLeft,
  Trash2,
  Type,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";
import { SortableList } from "@/components/internal/settings/SortableList";
import { SettingsSaveBar, useSettingsDraft, type SaveResult } from "@/components/internal/settings/SettingsSaveBar";
import { SettingsField, settingsInputClass, settingsSelectClass } from "@/components/internal/settings/fields";
import {
  EMPTY_JOB_REQUEST_FORM,
  JobRequestFormFields,
  type JobRequestFormValues,
} from "@/components/job-requests/JobRequestFormFields";
import { JobRequestIntro } from "@/components/job-requests/JobRequestIntro";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  canBeConditionSource,
  conditionValues,
  hasOptions,
} from "@/lib/job-requests/extra-fields";
import type { FieldType, FormConfig, FormFieldConfig, ShowCondition } from "@/types/form-config";

const FIELD_TYPE_ICONS: Record<FieldType, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  select: ListOrdered,
  multiselect: CheckSquare,
  boolean: ToggleLeft,
  number: Hash,
  date: CalendarDays,
  email: Mail,
};

// Espelha os campos fixos de src/components/job-requests/JobRequestFormFields.tsx
// (colunas estruturadas de job_requests — não podem ser removidas nem alteradas aqui).
const STANDARD_FIELDS: Array<{ section: string; label: string; type: FieldType; note?: string; required: boolean }> = [
  { section: "Dados da solicitação", label: "Título da vaga", type: "text", required: true },
  { section: "Dados da solicitação", label: "Área / Departamento", type: "text", required: true },
  { section: "Dados da solicitação", label: "Empresa / Unidade", type: "text", required: true },
  { section: "Dados da solicitação", label: "Gestor requisitante", type: "text", required: true },
  { section: "Dados da solicitação", label: "E-mail do gestor", type: "email", required: true },
  { section: "Dados da solicitação", label: "Quantidade de vagas", type: "number", required: true },
  { section: "Motivo da contratação", label: "Motivo da abertura", type: "select", required: true },
  { section: "Motivo da contratação", label: "Colaborador substituído", type: "text", note: "Quando o motivo é substituição", required: true },
  { section: "Motivo da contratação", label: "Justificativa da contratação", type: "textarea", required: true },
  { section: "Motivo da contratação", label: "Data desejada para admissão", type: "date", required: true },
  { section: "Condições da vaga", label: "Tipo de contratação", type: "select", required: true },
  { section: "Condições da vaga", label: "Modalidade", type: "select", required: true },
  { section: "Condições da vaga", label: "Horário / Jornada de trabalho", type: "text", required: false },
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

async function persist(config: FormConfig): Promise<SaveResult> {
  const res = await fetch("/api/form-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: body.error };
}

export function FormConfigEditor({ initialConfig }: { initialConfig: FormConfig }) {
  const draft = useSettingsDraft(initialConfig, persist);
  const config = draft.value;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [standardOpen, setStandardOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [removing, setRemoving] = useState<FormFieldConfig | null>(null);

  const setConfig = draft.setValue;
  const fields = config.fields;

  function updateField(id: string, patch: Partial<FormFieldConfig>) {
    setConfig((c) => {
      const before = c.fields.find((f) => f.id === id);
      if (!before) return c;
      const after = { ...before, ...patch };
      return {
        ...c,
        fields: c.fields.map((f) => {
          if (f.id === id) return after;
          // Regras que dependem desta pergunta acompanham a mudança das opções:
          // opção renomeada → a regra usa o novo nome; opção removida → a regra sai.
          if (f.showWhen?.fieldKey !== before.key) return f;
          if (!canBeConditionSource(after)) return { ...f, showWhen: undefined };
          const valid = conditionValues(after);
          if (valid.includes(f.showWhen.value)) return f;
          const oldIdx = conditionValues(before).indexOf(f.showWhen.value);
          const renamed =
            oldIdx >= 0 && (before.options?.length ?? 0) === (after.options?.length ?? 0) ? valid[oldIdx] : undefined;
          return { ...f, showWhen: renamed ? { ...f.showWhen, value: renamed } : undefined };
        }),
      };
    });
  }

  function addField(type: FieldType) {
    const id = genId();
    const field: FormFieldConfig = {
      id,
      key: `campo_${id}`,
      label: "Nova pergunta",
      type,
      required: false,
      options: hasOptions(type) ? ["Opção 1"] : undefined,
    };
    setConfig((c) => ({ ...c, fields: [...c.fields, field] }));
    setExpanded(id);
  }

  function duplicateField(src: FormFieldConfig) {
    const id = genId();
    setConfig((c) => {
      const i = c.fields.findIndex((f) => f.id === src.id);
      const copy: FormFieldConfig = { ...structuredClone(src), id, key: `campo_${id}`, label: `${src.label} (cópia)` };
      const next = [...c.fields];
      next.splice(i + 1, 0, copy);
      return { ...c, fields: next };
    });
    setExpanded(id);
  }

  function moveField(id: string, dir: -1 | 1) {
    setConfig((c) => {
      const i = c.fields.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.fields.length) return c;
      const next = [...c.fields];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...c, fields: next };
    });
  }

  function dependentsOf(field: FormFieldConfig) {
    return fields.filter((f) => f.showWhen?.fieldKey === field.key);
  }

  function removeField(field: FormFieldConfig) {
    setConfig((c) => ({
      ...c,
      // Perguntas que dependiam desta passam a aparecer sempre (condição removida).
      fields: c.fields
        .filter((f) => f.id !== field.id)
        .map((f) => (f.showWhen?.fieldKey === field.key ? { ...f, showWhen: undefined } : f)),
    }));
    if (expanded === field.id) setExpanded(null);
  }

  function requestRemove(field: FormFieldConfig) {
    if (dependentsOf(field).length > 0) setRemoving(field);
    else removeField(field);
  }

  const titleError = !config.title.trim() ? "Informe o título do formulário." : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <a
          href="/solicitar-vaga"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "tertiary" })}
        >
          <ExternalLink aria-hidden /> Abrir formulário publicado
        </a>
        <Button variant="secondary" icon={Eye} onClick={() => setPreviewOpen(true)}>
          Visualizar como gestor
        </Button>
      </div>

      <div className="space-y-5">
        <Panel title="Apresentação" description="Título e texto exibidos no topo do formulário.">
          <div className="grid gap-4 md:grid-cols-2">
            <SettingsField id="jr-cfg-title" label="Título" required error={titleError}>
              <input
                id="jr-cfg-title"
                type="text"
                maxLength={160}
                value={config.title}
                onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
                aria-invalid={!!titleError}
                className={settingsInputClass}
                placeholder="Ex.: Solicitação de Vaga | WG Baterias"
              />
            </SettingsField>
            <SettingsField id="jr-cfg-desc" label="Texto de apresentação" className="md:col-span-2">
              <textarea
                id="jr-cfg-desc"
                rows={3}
                maxLength={1000}
                value={config.description}
                onChange={(e) => setConfig((c) => ({ ...c, description: e.target.value }))}
                className={cn(settingsInputClass, "resize-y")}
                placeholder="Orientação para os gestores"
              />
            </SettingsField>
          </div>
        </Panel>

        {/* ── Campos padrão (estruturais) ── */}
        <section className="rounded-card border border-wg-border-lighter bg-white">
          <button
            type="button"
            onClick={() => setStandardOpen((o) => !o)}
            aria-expanded={standardOpen}
            aria-controls="jr-standard-fields"
            className="flex w-full items-center justify-between gap-3 rounded-card px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
          >
            <span>
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-sora text-section-title text-wg-ink">Campos padrão</span>
                <span className="text-meta text-wg-ink-muted">{STANDARD_FIELDS.length} campos</span>
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-meta text-wg-ink-muted">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Sempre presentes na solicitação — usados na aprovação, nos filtros e no histórico.
              </span>
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-wg-ink-muted transition-transform", standardOpen && "rotate-180")} aria-hidden />
          </button>
          {standardOpen && (
            <ul id="jr-standard-fields" className="divide-y divide-wg-border-lighter border-t border-wg-border-lighter">
              {STANDARD_FIELDS.map((f) => {
                const Icon = FIELD_TYPE_ICONS[f.type];
                return (
                  <li key={f.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-wg-bg text-wg-ink-muted">
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-body font-medium text-wg-ink">{f.label}</span>
                      <span className="ml-2 text-label text-wg-ink-muted">{FIELD_TYPE_LABELS[f.type]}</span>
                      {f.note && <span className="ml-2 text-label text-wg-ink-muted">· {f.note}</span>}
                    </span>
                    <span className="text-label text-wg-ink-muted">{f.required ? "Obrigatório" : "Opcional"}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-wg-border-light bg-wg-bg px-2 py-0.5 text-[11px] font-medium text-wg-ink-muted">
                      <Lock className="h-3 w-3" aria-hidden /> Campo estrutural
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Campos adicionais ── */}
        <section className="rounded-card border border-wg-border-lighter bg-white" aria-labelledby="jr-extra-title">
          <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h2 id="jr-extra-title" className="font-sora text-section-title text-wg-ink">
                  Campos adicionais
                </h2>
                <span className="text-meta text-wg-ink-muted">({fields.length})</span>
              </div>
              <p className="mt-0.5 text-meta text-wg-ink-muted">
                Adicione perguntas complementares aos campos padrão da solicitação. As respostas aparecem na tela da solicitação.
              </p>
            </div>
            {fields.length > 0 && <AddFieldMenu onAdd={addField} />}
          </header>

          {fields.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nenhum campo adicional"
              description="Adicione perguntas específicas que seus gestores deverão responder ao solicitar uma nova vaga."
              action={<AddFieldMenu onAdd={addField} />}
              className="border-t border-wg-border-lighter"
            />
          ) : (
            <SortableList
              label="Campos adicionais"
              items={fields}
              getId={(f) => f.id}
              getLabel={(f) => `Pergunta ${f.label}`}
              onReorder={(next) => setConfig((c) => ({ ...c, fields: next }))}
              className="divide-y divide-wg-border-lighter border-t border-wg-border-lighter"
              renderItem={(field, { handle, index }) => (
                <FieldRow
                  field={field}
                  fields={fields}
                  index={index}
                  handle={handle}
                  expanded={expanded === field.id}
                  onToggle={() => setExpanded((cur) => (cur === field.id ? null : field.id))}
                  onChange={(patch) => updateField(field.id, patch)}
                  onDuplicate={() => duplicateField(field)}
                  onMove={(dir) => moveField(field.id, dir)}
                  onRemove={() => requestRemove(field)}
                />
              )}
            />
          )}
        </section>
      </div>

      <SettingsSaveBar
        isDirty={draft.isDirty}
        isSaving={draft.isSaving}
        savedAt={draft.savedAt}
        onSave={draft.save}
        onDiscard={draft.discard}
      />

      <ConfirmModal
        isOpen={!!removing}
        title="Excluir esta pergunta?"
        message={
          removing
            ? `“${removing.label}” controla a exibição de ${dependentsOf(removing).length} outra(s) pergunta(s). Ao excluí-la, essas perguntas passam a aparecer sempre.`
            : ""
        }
        confirmLabel="Excluir pergunta"
        onConfirm={() => {
          if (removing) removeField(removing);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />

      <ManagerPreview open={previewOpen} onClose={() => setPreviewOpen(false)} config={config} />
    </>
  );
}

// ─── Menu "Adicionar campo" ──────────────────────────────────────────────────

function AddFieldMenu({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <DropdownMenu
      trigger={
        <>
          <Plus aria-hidden /> Adicionar campo
        </>
      }
      triggerClassName={buttonVariants({ variant: "primary" })}
      align="right"
      items={FIELD_TYPES.map((t) => ({ label: FIELD_TYPE_LABELS[t], icon: FIELD_TYPE_ICONS[t], onSelect: () => onAdd(t) }))}
    />
  );
}

// ─── Linha de um campo adicional ─────────────────────────────────────────────

function FieldRow({
  field,
  fields,
  index,
  handle,
  expanded,
  onToggle,
  onChange,
  onDuplicate,
  onMove,
  onRemove,
}: {
  field: FormFieldConfig;
  fields: FormFieldConfig[];
  index: number;
  handle: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<FormFieldConfig>) => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const Icon = FIELD_TYPE_ICONS[field.type];
  const panelId = `jr-field-${field.id}`;
  const source = field.showWhen ? fields.find((f) => f.key === field.showWhen!.fieldKey) : undefined;
  const missingOptions = hasOptions(field.type) && (field.options?.length ?? 0) === 0;

  return (
    <div className="bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        {handle}
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-wg-sidebar text-wg-green-dark">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="min-w-0 truncate rounded-sm text-left text-body font-semibold text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
          >
            {field.label || "Pergunta sem nome"}
          </button>
          <span className="text-label text-wg-ink-muted">{FIELD_TYPE_LABELS[field.type]}</span>
          {field.required && (
            <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-[11px] font-semibold text-neutral-fg">Obrigatório</span>
          )}
          {field.showWhen && (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-warning-fg">
              <Zap className="h-3 w-3" aria-hidden /> Condicional
            </span>
          )}
          {missingOptions && <span className="text-label font-medium text-danger-fg">Sem opções</span>}
        </div>

        <DropdownMenu
          ariaLabel={`Mais ações da pergunta ${field.label}`}
          title="Mais ações"
          trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
          triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
          portal
          items={[
            { label: "Duplicar", icon: Copy, onSelect: onDuplicate },
            { label: "Mover para cima", icon: ArrowUp, onSelect: () => onMove(-1), disabled: index === 0 },
            { label: "Mover para baixo", icon: ArrowDown, onSelect: () => onMove(1), disabled: index === fields.length - 1 },
            { type: "separator" },
            { label: "Excluir", icon: Trash2, danger: true, onSelect: onRemove },
          ]}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={expanded ? `Recolher ${field.label}` : `Editar ${field.label}`}
          title={expanded ? "Recolher" : "Editar"}
          className={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
        >
          <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      </div>

      {expanded && (
        <div id={panelId} className="space-y-4 border-t border-wg-border-lighter bg-wg-bg/50 px-4 py-4 sm:pl-[76px]">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <SettingsField id={`${panelId}-label`} label="Pergunta" required>
              <input
                id={`${panelId}-label`}
                autoFocus={field.label === "Nova pergunta"}
                onFocus={(e) => field.label === "Nova pergunta" && e.currentTarget.select()}
                value={field.label}
                maxLength={200}
                onChange={(e) => onChange({ label: e.target.value })}
                aria-invalid={!field.label.trim()}
                className={settingsInputClass}
              />
            </SettingsField>
            <SettingsField id={`${panelId}-type`} label="Tipo">
              <select
                id={`${panelId}-type`}
                value={field.type}
                onChange={(e) => {
                  const type = e.target.value as FieldType;
                  onChange({
                    type,
                    options: hasOptions(type) ? (field.options?.length ? field.options : ["Opção 1"]) : undefined,
                  });
                }}
                className={settingsSelectClass}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </SettingsField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SettingsField id={`${panelId}-help`} label="Texto de ajuda" hint="Aparece abaixo do campo, em cinza.">
              <input
                id={`${panelId}-help`}
                value={field.helpText ?? ""}
                maxLength={300}
                onChange={(e) => onChange({ helpText: e.target.value || undefined })}
                className={settingsInputClass}
                placeholder="Opcional"
              />
            </SettingsField>
            {!hasOptions(field.type) && field.type !== "boolean" && (
              <SettingsField id={`${panelId}-ph`} label="Exemplo dentro do campo" hint="Texto de exemplo (placeholder).">
                <input
                  id={`${panelId}-ph`}
                  value={field.placeholder ?? ""}
                  maxLength={200}
                  onChange={(e) => onChange({ placeholder: e.target.value || undefined })}
                  className={settingsInputClass}
                  placeholder="Opcional"
                />
              </SettingsField>
            )}
          </div>

          <div className="max-w-md rounded-control border border-wg-border-lighter bg-white px-3">
            <Toggle
              label="Resposta obrigatória"
              description={field.showWhen ? "Só é exigida quando a pergunta estiver visível." : undefined}
              checked={field.required}
              onChange={() => onChange({ required: !field.required })}
            />
          </div>

          {hasOptions(field.type) && (
            <OptionsEditor
              id={`${panelId}-opts`}
              options={field.options ?? []}
              onChange={(options) => onChange({ options })}
            />
          )}

          <ConditionEditor field={field} fields={fields} source={source} onChange={(showWhen) => onChange({ showWhen })} />
        </div>
      )}
    </div>
  );
}

// ─── Opções (Seleção / Múltipla escolha) ────────────────────────────────────

function OptionsEditor({ id, options, onChange }: { id: string; options: string[]; onChange: (o: string[]) => void }) {
  const [newOpt, setNewOpt] = useState("");
  const duplicate = newOpt.trim() && options.includes(newOpt.trim());

  function add() {
    const v = newOpt.trim();
    if (!v || options.includes(v)) return;
    onChange([...options, v]);
    setNewOpt("");
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-label font-semibold text-wg-ink-secondary">Opções de resposta</legend>
      {options.length === 0 && (
        <p className="mb-2 text-label font-normal text-danger-fg">Adicione ao menos uma opção.</p>
      )}
      <ul className="space-y-1.5">
        {options.map((opt, i) => (
          <li key={i} className="flex items-center gap-2">
            <label htmlFor={`${id}-${i}`} className="sr-only">
              Opção {i + 1}
            </label>
            <input
              id={`${id}-${i}`}
              value={opt}
              maxLength={120}
              onChange={(e) => onChange(options.map((o, j) => (j === i ? e.target.value : o)))}
              className={cn(settingsInputClass, "max-w-md")}
            />
            <button
              type="button"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              aria-label={`Remover opção ${opt || i + 1}`}
              title="Remover opção"
              className={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
            >
              <X aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex max-w-md gap-2">
        <label htmlFor={`${id}-new`} className="sr-only">
          Nova opção
        </label>
        <input
          id={`${id}-new`}
          value={newOpt}
          maxLength={120}
          onChange={(e) => setNewOpt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Nova opção…"
          className={settingsInputClass}
        />
        <Button variant="secondary" icon={Plus} onClick={add} disabled={!newOpt.trim() || !!duplicate}>
          Adicionar
        </Button>
      </div>
      {duplicate && <p className="mt-1 text-label font-normal text-danger-fg">Essa opção já existe.</p>}
    </fieldset>
  );
}

// ─── Condição de exibição (SE … ENTÃO mostrar) ───────────────────────────────

function ConditionEditor({
  field,
  fields,
  source,
  onChange,
}: {
  field: FormFieldConfig;
  fields: FormFieldConfig[];
  source: FormFieldConfig | undefined;
  onChange: (c: ShowCondition | undefined) => void;
}) {
  const candidates = useMemo(
    () => fields.filter((f) => f.id !== field.id && canBeConditionSource(f) && f.showWhen?.fieldKey !== field.key),
    [fields, field.id, field.key]
  );
  const idBase = `cond-${field.id}`;

  if (!field.showWhen) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-dashed border-wg-border-light bg-white px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-meta text-wg-ink-muted">
          <Zap className="h-3.5 w-3.5" aria-hidden />
          {candidates.length === 0
            ? "Para exibir esta pergunta só em certos casos, crie antes uma pergunta de Seleção, Múltipla escolha ou Sim / Não."
            : "Esta pergunta aparece sempre."}
        </p>
        {candidates.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={() =>
              onChange({ fieldKey: candidates[0].key, operator: "is", value: conditionValues(candidates[0])[0] ?? "" })
            }
          >
            Mostrar só quando…
          </Button>
        )}
      </div>
    );
  }

  const values = source ? conditionValues(source) : [];

  return (
    <fieldset className="rounded-control border border-warning-border bg-white p-3">
      <legend className="flex items-center gap-1.5 px-1 text-label font-semibold text-wg-ink-secondary">
        <Zap className="h-3.5 w-3.5 text-warning" aria-hidden /> Regra de exibição
      </legend>
      <div className="flex flex-wrap items-center gap-2 text-meta text-wg-ink-secondary">
        <span className="font-semibold">SE</span>
        <label htmlFor={`${idBase}-src`} className="sr-only">
          Pergunta
        </label>
        <select
          id={`${idBase}-src`}
          value={field.showWhen.fieldKey}
          onChange={(e) => {
            const src = candidates.find((f) => f.key === e.target.value);
            onChange({ fieldKey: e.target.value, operator: field.showWhen!.operator, value: src ? conditionValues(src)[0] ?? "" : "" });
          }}
          className={cn(settingsSelectClass, "w-auto max-w-[260px] py-1.5")}
        >
          {!source && <option value={field.showWhen.fieldKey}>Pergunta removida</option>}
          {candidates.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <label htmlFor={`${idBase}-op`} className="sr-only">
          Operador
        </label>
        <select
          id={`${idBase}-op`}
          value={field.showWhen.operator}
          onChange={(e) => onChange({ ...field.showWhen!, operator: e.target.value as ShowCondition["operator"] })}
          className={cn(settingsSelectClass, "w-auto py-1.5")}
        >
          <option value="is">{source?.type === "multiselect" ? "inclui" : "for"}</option>
          <option value="is_not">{source?.type === "multiselect" ? "não inclui" : "não for"}</option>
        </select>
        <label htmlFor={`${idBase}-val`} className="sr-only">
          Valor
        </label>
        <select
          id={`${idBase}-val`}
          value={field.showWhen.value}
          onChange={(e) => onChange({ ...field.showWhen!, value: e.target.value })}
          className={cn(settingsSelectClass, "w-auto max-w-[220px] py-1.5")}
        >
          {values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <span className="font-semibold">ENTÃO</span> mostrar esta pergunta.
      </div>
      <div className="mt-2 flex justify-end">
        <Button variant="tertiary" size="sm" icon={X} onClick={() => onChange(undefined)}>
          Remover regra
        </Button>
      </div>
    </fieldset>
  );
}

// ─── Visualizar como gestor ──────────────────────────────────────────────────

function ManagerPreview({ open, onClose, config }: { open: boolean; onClose: () => void; config: FormConfig }) {
  // Estado local e descartável: nada do que é digitado aqui é salvo ou enviado.
  const [values, setValues] = useState<JobRequestFormValues>(EMPTY_JOB_REQUEST_FORM);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setValues(EMPTY_JOB_REQUEST_FORM);
        onClose();
      }}
      size="xl"
      title="Visualizar como gestor"
      description="Pré-visualização com as alterações atuais, inclusive as ainda não salvas. Nada do que for preenchido aqui é enviado."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar pré-visualização
        </Button>
      }
    >
      <div className="mx-auto max-w-3xl py-4">
        <JobRequestIntro title={config.title || "Título do formulário"} description={config.description} />
        <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
          <JobRequestFormFields
            values={values}
            onChange={(p) => setValues((v) => ({ ...v, ...p }))}
            extraFields={config.fields}
          />
          <button
            type="button"
            disabled
            title="Indisponível na pré-visualização"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-wg-green px-6 py-3 text-sm font-semibold text-white opacity-60"
          >
            Enviar solicitação &rarr;
          </button>
        </form>
      </div>
    </Dialog>
  );
}
