import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Input padrão das Configurações (mesmo visual dos demais formulários do painel). */
export const settingsInputClass =
  "w-full rounded-control border border-wg-border-light bg-white px-3 py-2 text-body text-wg-ink placeholder:text-[#9AA590] " +
  "transition-colors focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30 " +
  "disabled:cursor-not-allowed disabled:bg-wg-bg disabled:text-wg-ink-muted aria-[invalid=true]:border-danger-border";

export const settingsSelectClass = cn(settingsInputClass, "cursor-pointer pr-8");

/** Rótulo + controle + ajuda/erro, com associação correta (htmlFor / aria-describedby). */
export function SettingsField({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-label font-semibold text-wg-ink-secondary">
        {label}
        {required && (
          <span className="ml-0.5 text-danger-fg" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-label font-normal text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-label font-normal text-wg-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Aria-describedby coerente com o que o SettingsField exibe. */
export function describedBy(id: string, { error, hint }: { error?: string | null; hint?: unknown }) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

/** Rótulo "Pré-visualização" + explicação, acima de um preview. */
export function PreviewPanel({
  title = "Pré-visualização",
  description,
  children,
  className,
  toolbar,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  toolbar?: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn("rounded-card border border-wg-border-lighter bg-white", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-wg-border-lighter px-4 py-3">
        <div>
          <p className="text-label font-semibold uppercase tracking-[0.08em] text-wg-ink-muted">{title}</p>
          {description && <p className="mt-0.5 text-meta text-wg-ink-muted">{description}</p>}
        </div>
        {toolbar}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
