"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  FileText,
  Link2,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";
import { SortableList } from "@/components/internal/settings/SortableList";
import { SettingsField, settingsInputClass, settingsSelectClass } from "@/components/internal/settings/fields";
import {
  CONDITION_LABELS,
  CONDITION_TYPES,
  type ConditionType,
  type DocCondition,
  type DocumentConfig,
  type ExtraFieldConfig,
  type FormConfig,
} from "@/lib/admissao/form-config";
import { describeCondition } from "./shared";

type Setter = (fn: (c: FormConfig) => FormConfig) => void;

export function buildCondition(type: ConditionType, values: string[]): DocCondition {
  switch (type) {
    case "gender":
      return { type: "gender", values };
    case "marital":
      return { type: "marital", values };
    case "hasChildren":
      return { type: "hasChildren" };
    case "hasItauAccount":
      return { type: "hasItauAccount" };
    case "isDriverOperator":
      return { type: "isDriverOperator" };
    default:
      return { type: "always" };
  }
}

export function conditionValues(c: DocCondition): string[] {
  return c.type === "gender" || c.type === "marital" ? c.values : [];
}

/** Aba "Documentos": o que o candidato envia, quando é pedido e se é obrigatório. */
export function DocumentsTab({
  config,
  set,
  documentTypeNames,
  expanded,
  setExpanded,
}: {
  config: FormConfig;
  set: Setter;
  /** Nomes do cadastro "Tipos de documento" — o anexo é classificado pelo nome igual. */
  documentTypeNames: string[];
  expanded: string | null;
  setExpanded: (key: string | null) => void;
}) {
  const [removing, setRemoving] = useState<DocumentConfig | null>(null);
  const typeNames = new Set(documentTypeNames.map((n) => n.trim().toLowerCase()));
  const docs = config.documents;

  function updateDoc(key: string, patch: Partial<DocumentConfig>) {
    set((c) => ({ ...c, documents: c.documents.map((d) => (d.key === key ? { ...d, ...patch } : d)) }));
  }

  function move(key: string, dir: -1 | 1) {
    set((c) => {
      const i = c.documents.findIndex((d) => d.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.documents.length) return c;
      const next = [...c.documents];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...c, documents: next };
    });
  }

  function addDoc() {
    const key = `doc_${Math.random().toString(36).slice(2, 8)}`;
    set((c) => ({
      ...c,
      documents: [...c.documents, { key, label: "Novo documento", required: false, condition: { type: "always" } }],
    }));
    setExpanded(key);
  }

  const requiredCount = docs.filter((d) => d.required).length;
  const conditionalCount = docs.filter((d) => d.condition.type !== "always").length;

  return (
    <section className="rounded-card border border-wg-border-lighter bg-white" aria-labelledby="adm-docs-title">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 id="adm-docs-title" className="font-sora text-section-title text-wg-ink">
              Documentos
            </h2>
            <span className="text-meta text-wg-ink-muted">
              {docs.length} no total · {requiredCount} obrigatório(s) · {conditionalCount} condicional(is)
            </span>
          </div>
          <p className="mt-0.5 text-meta text-wg-ink-muted">
            Arraste pela alça <span aria-hidden>⋮⋮</span> para definir a ordem em que aparecem para o candidato.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={addDoc}>
          Novo documento
        </Button>
      </header>

      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum documento no formulário"
          description="Adicione os documentos que o candidato aprovado precisa enviar."
          className="border-t border-wg-border-lighter"
        />
      ) : (
        <SortableList
          label="Documentos do formulário"
          items={docs}
          getId={(d) => d.key}
          getLabel={(d) => `Documento ${d.label}`}
          onReorder={(next) => set((c) => ({ ...c, documents: next }))}
          className="divide-y divide-wg-border-lighter border-t border-wg-border-lighter"
          renderItem={(doc, { handle, index }) => {
            const open = expanded === doc.key;
            const linked = typeNames.has(doc.label.trim().toLowerCase());
            const panelId = `adm-doc-${doc.key}`;
            return (
              <div className="bg-white">
                <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                  {handle}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-wg-sidebar text-wg-green-dark">
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : doc.key)}
                      aria-expanded={open}
                      aria-controls={panelId}
                      className="min-w-0 truncate rounded-sm text-left text-body font-semibold text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
                    >
                      {doc.label || "Documento sem nome"}
                    </button>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        doc.required ? "bg-neutral-bg text-neutral-fg" : "border border-wg-border-light text-wg-ink-muted"
                      )}
                    >
                      {doc.required ? "Obrigatório" : "Opcional"}
                    </span>
                    <span className="text-label text-wg-ink-muted">{describeCondition(doc.condition, config)}</span>
                    {!linked && (
                      <span
                        className="inline-flex items-center gap-1 text-label font-medium text-warning-fg"
                        title="Nenhum tipo de documento com este nome em Cadastros. Os anexos chegam sem categoria."
                      >
                        <AlertTriangle className="h-3 w-3" aria-hidden /> Sem tipo de documento
                      </span>
                    )}
                  </div>
                  <DropdownMenu
                    ariaLabel={`Mais ações do documento ${doc.label}`}
                    title="Mais ações"
                    portal
                    trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
                    triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                    items={[
                      { label: "Mover para cima", icon: ArrowUp, disabled: index === 0, onSelect: () => move(doc.key, -1) },
                      { label: "Mover para baixo", icon: ArrowDown, disabled: index === docs.length - 1, onSelect: () => move(doc.key, 1) },
                      { type: "separator" },
                      {
                        label: "Excluir",
                        icon: Trash2,
                        danger: true,
                        disabled: docs.length <= 1,
                        hint: docs.length <= 1 ? "mínimo de 1" : undefined,
                        onSelect: () => setRemoving(doc),
                      },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : doc.key)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    aria-label={open ? `Recolher ${doc.label}` : `Editar ${doc.label}`}
                    title={open ? "Recolher" : "Editar"}
                    className={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                  >
                    <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
                  </button>
                </div>
                {open && (
                  <div id={panelId} className="border-t border-wg-border-lighter bg-wg-bg/50 px-4 py-4 sm:pl-[76px]">
                    <DocumentEditor
                      doc={doc}
                      config={config}
                      linked={linked}
                      onChange={(patch) => updateDoc(doc.key, patch)}
                    />
                  </div>
                )}
              </div>
            );
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!removing}
        title="Excluir este documento do formulário?"
        message={`“${removing?.label ?? ""}” deixa de ser pedido nos próximos formulários. Arquivos já enviados pelos candidatos continuam nas fichas.`}
        confirmLabel="Excluir documento"
        onConfirm={() => {
          if (removing) set((c) => ({ ...c, documents: c.documents.filter((d) => d.key !== removing.key) }));
          if (expanded === removing?.key) setExpanded(null);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}

function DocumentEditor({
  doc,
  config,
  linked,
  onChange,
}: {
  doc: DocumentConfig;
  config: FormConfig;
  linked: boolean;
  onChange: (patch: Partial<DocumentConfig>) => void;
}) {
  const base = `adm-doc-${doc.key}`;
  const ctype = doc.condition.type;
  const cvalues = conditionValues(doc.condition);
  const valueOptions = ctype === "gender" ? config.genderOptions : ctype === "marital" ? config.maritalOptions : [];

  function toggleValue(v: string) {
    const next = cvalues.includes(v) ? cvalues.filter((x) => x !== v) : [...cvalues, v];
    onChange({ condition: buildCondition(ctype, next) });
  }

  function updateExtra(i: number, patch: Partial<ExtraFieldConfig>) {
    onChange({ extraFields: (doc.extraFields ?? []).map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <SettingsField
          id={`${base}-label`}
          label="Nome do documento"
          required
          hint={
            linked ? (
              <span className="inline-flex items-center gap-1 text-success-fg">
                <Link2 className="h-3 w-3" aria-hidden /> Anexos classificados como o tipo de documento de mesmo nome.
              </span>
            ) : (
              <span className="text-warning-fg">
                Nenhum tipo de documento com este nome em Cadastros › Tipos de documento — os anexos chegam sem categoria.
              </span>
            )
          }
        >
          <input
            id={`${base}-label`}
            maxLength={200}
            value={doc.label}
            onChange={(e) => onChange({ label: e.target.value })}
            aria-invalid={!doc.label.trim()}
            aria-describedby={`${base}-label-hint`}
            className={settingsInputClass}
          />
        </SettingsField>
        <SettingsField id={`${base}-cond`} label="Quando pedir">
          <select
            id={`${base}-cond`}
            value={ctype}
            onChange={(e) => onChange({ condition: buildCondition(e.target.value as ConditionType, cvalues) })}
            className={settingsSelectClass}
          >
            {CONDITION_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONDITION_LABELS[t]}
              </option>
            ))}
          </select>
        </SettingsField>
      </div>

      {(ctype === "gender" || ctype === "marital") && (
        <fieldset>
          <legend className="mb-1.5 text-label font-semibold text-wg-ink-secondary">Pedir quando a resposta for</legend>
          <div className="flex flex-wrap gap-2">
            {valueOptions.map((v) => {
              const on = cvalues.includes(v);
              return (
                <label
                  key={v}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-meta transition-colors",
                    on ? "border-wg-green bg-wg-green/15 font-medium text-wg-green-dark" : "border-wg-border-light bg-white text-wg-ink-secondary hover:border-wg-green/60"
                  )}
                >
                  <input type="checkbox" checked={on} onChange={() => toggleValue(v)} className="h-3.5 w-3.5 accent-wg-green" />
                  {v}
                </label>
              );
            })}
          </div>
          {cvalues.length === 0 && (
            <p className="mt-1 text-label font-normal text-warning-fg">Marque ao menos uma resposta, senão o documento nunca é pedido.</p>
          )}
        </fieldset>
      )}

      <div className="max-w-md rounded-control border border-wg-border-lighter bg-white px-3">
        <Toggle
          label="Envio obrigatório"
          description={ctype !== "always" ? "Só é exigido quando a condição acima for atendida." : undefined}
          checked={doc.required}
          onChange={() => onChange({ required: !doc.required })}
        />
      </div>

      <div>
        <p className="mb-1.5 text-label font-semibold text-wg-ink-secondary">Campos de texto junto ao documento</p>
        {(doc.extraFields ?? []).length === 0 ? (
          <p className="text-label font-normal text-wg-ink-muted">Nenhum. Ex.: número do PIS junto à carteira de trabalho.</p>
        ) : (
          <ul className="space-y-2">
            {(doc.extraFields ?? []).map((f, i) => (
              <li key={i} className="rounded-control border border-wg-border-lighter bg-white p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SettingsField id={`${base}-x${i}-label`} label="Rótulo" required>
                    <input
                      id={`${base}-x${i}-label`}
                      value={f.label}
                      maxLength={160}
                      onChange={(e) => updateExtra(i, { label: e.target.value })}
                      className={settingsInputClass}
                    />
                  </SettingsField>
                  <SettingsField id={`${base}-x${i}-key`} label="Chave interna" required>
                    <input
                      id={`${base}-x${i}-key`}
                      value={f.key}
                      maxLength={60}
                      onChange={(e) => updateExtra(i, { key: e.target.value.trim() })}
                      className={settingsInputClass}
                    />
                  </SettingsField>
                  <SettingsField id={`${base}-x${i}-ph`} label="Exemplo no campo">
                    <input
                      id={`${base}-x${i}-ph`}
                      value={f.placeholder ?? ""}
                      maxLength={160}
                      onChange={(e) => updateExtra(i, { placeholder: e.target.value })}
                      className={settingsInputClass}
                    />
                  </SettingsField>
                  <SettingsField id={`${base}-x${i}-mask`} label="Formato">
                    <select
                      id={`${base}-x${i}-mask`}
                      value={f.mask ?? "none"}
                      onChange={(e) => updateExtra(i, { mask: e.target.value as ExtraFieldConfig["mask"] })}
                      className={settingsSelectClass}
                    >
                      <option value="none">Texto livre</option>
                      <option value="pis">PIS (000.00000.00-0)</option>
                    </select>
                  </SettingsField>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-meta text-wg-ink-secondary">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => updateExtra(i, { required: e.target.checked })}
                      className="h-4 w-4 accent-wg-green"
                    />
                    Obrigatório
                  </label>
                  <Button
                    variant="tertiary"
                    size="sm"
                    icon={X}
                    onClick={() => onChange({ extraFields: (doc.extraFields ?? []).filter((_, j) => j !== i) })}
                  >
                    Remover campo
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="tertiary"
          size="sm"
          icon={Plus}
          className="mt-2"
          onClick={() =>
            onChange({
              extraFields: [
                ...(doc.extraFields ?? []),
                { key: `campo_${Math.random().toString(36).slice(2, 6)}`, label: "", required: false, mask: "none" },
              ],
            })
          }
        >
          Adicionar campo de texto
        </Button>
      </div>

      <p className="text-label font-normal text-wg-ink-muted">Chave interna do documento: {doc.key}</p>
    </div>
  );
}
