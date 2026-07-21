"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit2,
  Plus,
  X,
  Type,
  AlignLeft,
  ListOrdered,
  GripVertical,
  ExternalLink,
  Eye,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormConfig, FormFieldConfig, FieldType, ShowCondition } from "@/types/form-config";

interface Props {
  initialConfig: FormConfig;
}

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";

const FIELD_TYPE_ICONS: Record<FieldType, typeof Type> = {
  text: Type,
  textarea: AlignLeft,
  select: ListOrdered,
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  select: "Seleção",
};

const OPERATOR_LABELS: Record<string, string> = {
  is: "é igual a",
  is_not: "é diferente de",
};

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function FormConfigEditor({ initialConfig }: Props) {
  const [config, setConfig] = useState<FormConfig>(initialConfig);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addingField, setAddingField] = useState(false);

  const markDirty = () => setSaved(false);

  const updateTitle = useCallback((title: string) => {
    setConfig((c) => ({ ...c, title }));
    markDirty();
  }, []);

  const updateDescription = useCallback((description: string) => {
    setConfig((c) => ({ ...c, description }));
    markDirty();
  }, []);

  const updateField = useCallback((id: string, patch: Partial<FormFieldConfig>) => {
    setConfig((c) => ({
      ...c,
      fields: c.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
    markDirty();
  }, []);

  const removeField = useCallback((id: string) => {
    setConfig((c) => ({ ...c, fields: c.fields.filter((f) => f.id !== id) }));
    if (editingId === id) setEditingId(null);
    markDirty();
  }, [editingId]);

  const moveField = useCallback((id: string, dir: -1 | 1) => {
    setConfig((c) => {
      const idx = c.fields.findIndex((f) => f.id === id);
      if (idx < 0) return c;
      const next = idx + dir;
      if (next < 0 || next >= c.fields.length) return c;
      const fields = [...c.fields];
      [fields[idx], fields[next]] = [fields[next], fields[idx]];
      return { ...c, fields };
    });
    markDirty();
  }, []);

  const addField = useCallback((type: FieldType) => {
    const id = genId();
    const newField: FormFieldConfig = {
      id,
      key: `campo_${id}`,
      label: FIELD_TYPE_LABELS[type],
      type,
      required: false,
      placeholder: "",
      options: type === "select" ? [] : undefined,
    };
    setConfig((c) => ({ ...c, fields: [...c.fields, newField] }));
    setEditingId(id);
    setAddingField(false);
    markDirty();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/form-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveError(body?.error ?? "Erro ao salvar.");
        return;
      }
      setSaved(true);
    } catch {
      setSaveError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  // Fields that can be used as condition sources (select fields with options)
  const selectFields = config.fields.filter(
    (f) => f.type === "select" && (f.options?.length ?? 0) > 0
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Cabeçalho do formulário
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
          <input
            type="text"
            value={config.title}
            onChange={(e) => updateTitle(e.target.value)}
            className={inputClass}
            placeholder="Ex: Abertura de Vaga | WG Baterias"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <textarea
            value={config.description}
            onChange={(e) => updateDescription(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="Texto de orientação para os gestores"
          />
        </div>
        <a
          href="/solicitar-vaga"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-wg-green font-medium hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir formulário público
        </a>
      </section>

      {/* Campos */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Campos ({config.fields.length})
          </h2>
        </div>

        <ul className="divide-y divide-gray-100">
          {config.fields.map((field, idx) => {
            const Icon = FIELD_TYPE_ICONS[field.type];
            const isEditing = editingId === field.id;
            const hasCondition = !!field.showWhen;

            return (
              <li key={field.id}>
                {/* Row */}
                <div className="flex items-center gap-3 px-5 py-3">
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                  <div className="w-7 h-7 rounded-md bg-wg-green/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-wg-green-dark" />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{field.label}</span>
                    <span className="text-xs text-gray-400">{FIELD_TYPE_LABELS[field.type]}</span>
                    {field.required && (
                      <span className="text-xs text-red-500 font-medium">obrigatório</span>
                    )}
                    {hasCondition && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                        <Zap className="w-3 h-3" />
                        condicional
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveField(field.id, -1)}
                      disabled={idx === 0}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                      title="Mover para cima"
                    >
                      <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => moveField(field.id, 1)}
                      disabled={idx === config.fields.length - 1}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                      title="Mover para baixo"
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => setEditingId(isEditing ? null : field.id)}
                      className={cn(
                        "p-1.5 rounded transition-colors",
                        isEditing
                          ? "bg-wg-green/15 text-wg-green-dark"
                          : "hover:bg-gray-100 text-gray-500"
                      )}
                      title="Editar campo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeField(field.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remover campo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline editor */}
                {isEditing && (
                  <div className="px-5 pb-5 pt-1 bg-gray-50 border-t border-gray-100 space-y-4">
                    {/* Label + Type */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Rótulo do campo
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Tipo de campo
                        </label>
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateField(field.id, {
                              type: e.target.value as FieldType,
                              options:
                                e.target.value === "select" ? field.options ?? [] : undefined,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="text">Texto curto</option>
                          <option value="textarea">Texto longo</option>
                          <option value="select">Seleção (dropdown)</option>
                        </select>
                      </div>
                    </div>

                    {/* Placeholder */}
                    {field.type !== "select" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Placeholder
                        </label>
                        <input
                          type="text"
                          value={field.placeholder ?? ""}
                          onChange={(e) =>
                            updateField(field.id, { placeholder: e.target.value })
                          }
                          className={inputClass}
                          placeholder="Texto de exemplo dentro do campo"
                        />
                      </div>
                    )}

                    {/* Required */}
                    <label className="flex items-center gap-2 cursor-pointer w-fit">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="w-4 h-4 accent-wg-green rounded"
                      />
                      <span className="text-xs font-medium text-gray-700">Campo obrigatório</span>
                    </label>

                    {/* Options for select */}
                    {field.type === "select" && (
                      <OptionsEditor
                        options={field.options ?? []}
                        onChange={(opts) => updateField(field.id, { options: opts })}
                      />
                    )}

                    {/* Conditional logic (When/Then) */}
                    <ConditionalEditor
                      field={field}
                      allFields={config.fields}
                      selectFields={selectFields}
                      onChange={(showWhen) => updateField(field.id, { showWhen })}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Adicionar campo */}
        <div className="px-5 py-4 border-t border-gray-100">
          {addingField ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-500 self-center mr-1">Adicionar:</span>
              {(["text", "textarea", "select"] as FieldType[]).map((type) => {
                const Icon = FIELD_TYPE_ICONS[type];
                return (
                  <button
                    key={type}
                    onClick={() => addField(type)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:border-wg-green hover:text-wg-green-dark transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {FIELD_TYPE_LABELS[type]}
                  </button>
                );
              })}
              <button
                onClick={() => setAddingField(false)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingField(true)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-wg-green-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar campo
            </button>
          )}
        </div>
      </section>

      {/* Salvar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar configuração"
          )}
        </button>
        {saved && !saveError && (
          <span className="flex items-center gap-1.5 text-sm text-wg-green font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Salvo!
          </span>
        )}
        {saveError && <span className="text-sm text-red-500">{saveError}</span>}
      </div>
    </div>
  );
}

// ─── Options Editor ───────────────────────────────────────────────────────────

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const [newOpt, setNewOpt] = useState("");

  function addOption() {
    const val = newOpt.trim();
    if (!val || options.includes(val)) return;
    onChange([...options, val]);
    setNewOpt("");
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-2">Opções do dropdown</label>
      <ul className="space-y-1.5 mb-2">
        {options.map((opt, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => {
                const next = [...options];
                next[idx] = e.target.value;
                onChange(next);
              }}
              className={`${inputClass} flex-1`}
            />
            <button
              onClick={() => onChange(options.filter((_, i) => i !== idx))}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          type="text"
          value={newOpt}
          onChange={(e) => setNewOpt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
          placeholder="Nova opção..."
          className={`${inputClass} flex-1`}
        />
        <button
          onClick={addOption}
          className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:border-wg-green hover:text-wg-green-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Conditional Logic Editor (When/Then) ────────────────────────────────────

interface ConditionalEditorProps {
  field: FormFieldConfig;
  allFields: FormFieldConfig[];
  selectFields: FormFieldConfig[];
  onChange: (showWhen: ShowCondition | undefined) => void;
}

function ConditionalEditor({ field, selectFields, onChange }: ConditionalEditorProps) {
  const hasCondition = !!field.showWhen;

  // Select fields excluding self
  const candidates = selectFields.filter((f) => f.id !== field.id);

  function addCondition() {
    if (candidates.length === 0) return;
    const src = candidates[0];
    onChange({
      fieldKey: src.key,
      operator: "is",
      value: src.options?.[0] ?? "",
    });
  }

  function removeCondition() {
    onChange(undefined);
  }

  function patchCondition(patch: Partial<ShowCondition>) {
    if (!field.showWhen) return;
    onChange({ ...field.showWhen, ...patch });
  }

  // When source field changes, reset value to first option of new field
  function handleSourceChange(key: string) {
    const src = candidates.find((f) => f.key === key);
    onChange({
      fieldKey: key,
      operator: field.showWhen?.operator ?? "is",
      value: src?.options?.[0] ?? "",
    });
  }

  const sourceField = candidates.find((f) => f.key === field.showWhen?.fieldKey);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          Automação (ocultar / mostrar)
        </div>
        {!hasCondition ? (
          <button
            onClick={addCondition}
            disabled={candidates.length === 0}
            title={candidates.length === 0 ? "Adicione um campo de seleção primeiro" : undefined}
            className="inline-flex items-center gap-1 text-xs text-wg-green font-medium hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 h-3" />
            Adicionar regra
          </button>
        ) : (
          <button
            onClick={removeCondition}
            className="text-xs text-red-500 hover:underline"
          >
            Remover regra
          </button>
        )}
      </div>

      {!hasCondition ? (
        <div className="px-4 py-3 text-xs text-gray-400">
          {candidates.length === 0
            ? "Para adicionar automações, crie primeiro um campo de seleção com opções."
            : "Este campo aparece sempre. Adicione uma regra para exibi-lo apenas em condições específicas."}
        </div>
      ) : (
        <div className="px-4 py-3 space-y-3">
          {/* When */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Quando
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Source field */}
              <select
                value={field.showWhen?.fieldKey ?? ""}
                onChange={(e) => handleSourceChange(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-wg-green/40 focus:border-wg-green"
              >
                {candidates.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>

              {/* Operator */}
              <select
                value={field.showWhen?.operator ?? "is"}
                onChange={(e) =>
                  patchCondition({ operator: e.target.value as "is" | "is_not" })
                }
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-wg-green/40 focus:border-wg-green"
              >
                {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>

              {/* Value */}
              {sourceField && (sourceField.options?.length ?? 0) > 0 ? (
                <select
                  value={field.showWhen?.value ?? ""}
                  onChange={(e) => patchCondition({ value: e.target.value })}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-wg-green/40 focus:border-wg-green"
                >
                  {sourceField.options!.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={field.showWhen?.value ?? ""}
                  onChange={(e) => patchCondition({ value: e.target.value })}
                  placeholder="Valor..."
                  className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-wg-green/40 focus:border-wg-green w-28"
                />
              )}
            </div>
          </div>

          {/* Then */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Então
            </p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-wg-green/10 border border-wg-green/30">
                <Eye className="w-3.5 h-3.5 text-wg-green-dark" />
                <span className="text-xs font-medium text-wg-green-dark">Mostrar este campo</span>
              </div>
              <span className="text-xs text-gray-400">
                (oculto por padrão)
              </span>
            </div>
          </div>

          {/* Preview of the rule */}
          {field.showWhen && sourceField && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800">
              <span className="font-semibold">Regra:</span> Quando &ldquo;
              {sourceField.label}&rdquo; {OPERATOR_LABELS[field.showWhen.operator]} &ldquo;
              {field.showWhen.value}&rdquo;, mostrar &ldquo;{field.label}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
