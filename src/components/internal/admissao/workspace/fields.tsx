"use client";

import type { ReactNode } from "react";
import { Pencil, UserRound, X } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { AdmissionSection } from "@/lib/admissao/workspace";
import { useAdmissionWorkspace } from "./context";
import type { Option } from "./types";

// Campos da ficha: em MODO LEITURA o valor aparece como informação (sem cara de input);
// em MODO EDIÇÃO vira controle de formulário. O modo é por seção.

export const inputClass =
  "w-full h-9 rounded-control border border-wg-border-light bg-white px-3 text-sm text-wg-ink placeholder:text-wg-ink-muted/70 transition-colors hover:border-[#C9D9B4] focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30 aria-[invalid=true]:border-danger-border aria-[invalid=true]:focus:ring-danger/20";

/** Selo discreto de origem do dado ("Informado pelo candidato"). */
export function SourceTag({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-px text-[11px] font-semibold text-info-fg"
    >
      <UserRound className="h-3 w-3" aria-hidden />
      {children}
    </span>
  );
}

interface SectionProps {
  section: AdmissionSection;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  editLabel?: string;
  /** Aviso exibido no topo enquanto a seção está em edição. */
  editNotice?: ReactNode;
  children: ReactNode;
  id?: string;
}

/** Painel com o botão "Editar" / "Cancelar" da seção. */
export function EditableSection({ section, title, description, meta, editLabel = "Editar", editNotice, children, id }: SectionProps) {
  const { canManage, isEditing, startEdit, cancelEdit } = useAdmissionWorkspace();
  const editing = isEditing(section);
  return (
    <Panel
      id={id}
      title={title}
      meta={meta}
      description={description}
      className={cn(editing && "border-wg-green/60 ring-1 ring-wg-green/20")}
      action={
        canManage ? (
          editing ? (
            <Button size="sm" variant="tertiary" icon={X} onClick={() => cancelEdit(section)}>
              Cancelar
            </Button>
          ) : (
            <Button size="sm" variant="secondary" icon={Pencil} onClick={() => startEdit(section)}>
              {editLabel}
            </Button>
          )
        ) : null
      }
    >
      {editing && editNotice && (
        <p className="mb-4 mt-2 rounded-control bg-wg-bg px-3 py-2 text-meta text-wg-ink-secondary">{editNotice}</p>
      )}
      <div className="pt-2">{children}</div>
    </Panel>
  );
}

/** Grade de campos: <dl> em leitura, <div> em edição. */
export function FieldGrid({ editing, cols = 2, children }: { editing: boolean; cols?: 2 | 3; children: ReactNode }) {
  const cls = cn("grid gap-x-6 gap-y-4", cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2");
  return editing ? <div className={cls}>{children}</div> : <dl className={cls}>{children}</dl>;
}

interface DataFieldProps {
  label: string;
  htmlFor: string;
  editing: boolean;
  /** Valor formatado para leitura (null = não informado). */
  view: ReactNode | null;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Alterado e ainda não salvo. */
  changed?: boolean;
  className?: string;
  children: ReactNode;
}

export function DataField({ label, htmlFor, editing, view, required, hint, error, changed, className, children }: DataFieldProps) {
  if (!editing) {
    const text = typeof view === "string" ? view : undefined;
    return (
      <div className={cn("min-w-0", className)}>
        <dt className="flex items-center gap-1.5 text-label text-wg-ink-muted">
          {label}
          {changed && <span className="h-1.5 w-1.5 rounded-full bg-warning" title="Alterado, ainda não salvo" aria-label="alterado, não salvo" />}
        </dt>
        <dd className={cn("mt-0.5 truncate text-body", view ? "text-wg-ink" : "text-wg-ink-muted")} title={text}>
          {view ?? "Não informado"}
        </dd>
      </div>
    );
  }
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-wg-ink-secondary">
        {label}
        {required && <span className="text-danger-fg"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-[12px] font-medium text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-[12px] text-wg-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Atributos de acessibilidade do controle ligados à mensagem de erro/dica do DataField. */
export function fieldA11y(id: string, error?: string, hint?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

/**
 * Select de cadastro do banco. Se o valor gravado não está mais entre os ativos, ele
 * continua como opção ("inativo") — salvar a ficha nunca apaga o vínculo sem o RH pedir.
 */
export function RegistrySelect({
  id,
  value,
  onChange,
  options,
  savedId,
  savedName,
  placeholder = "Selecione",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  savedId: string | null;
  savedName: string | null;
  placeholder?: string;
}) {
  const inactive = savedId && !options.some((o) => o.id === savedId) ? { id: savedId, name: `${savedName ?? "Item removido"} (inativo)` } : null;
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">{placeholder}</option>
      {inactive && <option value={inactive.id}>{inactive.name}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
