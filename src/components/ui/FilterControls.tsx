"use client";

import { useId, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/Button";

/**
 * Controles de filtro compartilhados pelas páginas de módulo (Calendário, Relatórios,
 * Atividades, Usuários, Avaliações): busca, select com prefixo e a barra que os organiza.
 */

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-[220px] flex-1", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wg-ink-muted/70" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-control border border-wg-border-light bg-white pl-9 pr-3 text-body text-wg-ink placeholder:text-wg-ink-muted/70 outline-none focus:border-wg-green focus:ring-2 focus:ring-wg-green/30"
      />
    </div>
  );
}

/**
 * Select com prefixo fixo: "Empresa: Todas". A primeira opção é o valor neutro
 * (sem filtro) — qualquer outra deixa a borda destacada.
 */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  const active = value !== options[0]?.value;
  return (
    <label
      className={cn(
        "inline-flex h-9 min-w-0 items-center gap-1 rounded-control border bg-white pl-2.5 pr-1 text-body transition-colors focus-within:border-wg-green focus-within:ring-2 focus-within:ring-wg-green/30",
        active ? "border-wg-green-dark/40 bg-wg-sidebar/40" : "border-wg-border-light",
        className
      )}
    >
      <span className="whitespace-nowrap text-wg-ink-muted">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="min-w-0 max-w-[220px] cursor-pointer truncate bg-transparent py-1 pr-1 font-medium text-wg-ink outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Faixa de filtros: busca (sempre visível), filtros (recolhidos atrás de "Filtros" em
 * telas pequenas), "Limpar filtros" quando há algo ativo e um slot à direita
 * (alternância de visualização, contagem).
 */
export function FilterBar({
  search,
  children,
  activeCount = 0,
  onClear,
  trailing,
  className,
}: {
  search?: ReactNode;
  children?: ReactNode;
  activeCount?: number;
  onClear?: () => void;
  trailing?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {search}
        {children && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className={buttonVariants({ variant: "secondary", className: "lg:hidden" })}
          >
            <SlidersHorizontal aria-hidden />
            Filtros
            {activeCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-wg-green-dark px-1 text-[11px] font-bold text-white">
                {activeCount}
                <span className="sr-only"> ativos</span>
              </span>
            )}
          </button>
        )}
        {children && (
          <div id={panelId} className={cn("w-full flex-wrap items-center gap-2 lg:flex lg:w-auto", open ? "flex" : "hidden")}>
            {children}
          </div>
        )}
        {activeCount > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className={buttonVariants({ variant: "tertiary", size: "sm", className: "text-wg-green-dark" })}
          >
            <X aria-hidden />
            Limpar filtros
          </button>
        )}
        {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
      </div>
    </div>
  );
}
