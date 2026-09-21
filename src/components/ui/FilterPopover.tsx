"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/Button";

export interface FilterOption {
  value: string;
  label: string;
  /** Quantidade de registros com esse valor (ajuda a decidir antes de filtrar). */
  count?: number;
}

export interface FilterSection {
  key: string;
  title: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  /** single = rádio (um valor ou nenhum); multi = checkboxes (default). */
  mode?: "multi" | "single";
}

interface PopoverProps {
  sections: FilterSection[];
  activeCount: number;
  onClear: () => void;
}

/**
 * Botão "Filtros" + painel com seções de checkboxes nativos (teclado e leitor de tela
 * funcionam sem esforço). Fecha com Esc ou clique fora. Os filtros ativos aparecem
 * fora do painel em <ActiveFilterChips>.
 */
export function FilterPopover({ sections, activeCount, onClear }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = sections.filter((s) => s.options.length > 0);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={buttonVariants({
          variant: "secondary",
          className: activeCount > 0 ? "border-wg-green-dark/40 bg-wg-sidebar text-wg-ink" : undefined,
        })}
      >
        <SlidersHorizontal aria-hidden />
        Filtros
        {activeCount > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-wg-green-dark px-1 text-[11px] font-bold text-white">
            {activeCount}
            <span className="sr-only"> ativos</span>
          </span>
        )}
        <ChevronDown aria-hidden className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-[calc(100%+6px)] z-40 w-[min(92vw,560px)] rounded-card border border-wg-border-lighter bg-white shadow-[0_12px_32px_rgba(26,34,19,.12)]"
        >
          <div className="grid max-h-[60vh] gap-x-4 gap-y-3 overflow-y-auto p-3 sm:grid-cols-2">
            {visible.map((s) => (
              <fieldset key={s.key} className="min-w-0">
                <legend className="mb-1 px-2 font-inter text-label uppercase tracking-wide text-wg-ink-muted">{s.title}</legend>
                <div className="flex max-h-48 flex-col overflow-y-auto">
                  {s.options.map((o) => {
                    const checked = s.selected.includes(o.value);
                    return (
                      <label
                        key={o.value}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-wg-ink hover:bg-wg-bg"
                      >
                        <input
                          type={s.mode === "single" ? "radio" : "checkbox"}
                          name={s.mode === "single" ? `${panelId}-${s.key}` : undefined}
                          checked={checked}
                          onChange={() => s.onToggle(o.value)}
                          onClick={(e) => {
                            // Rádio "desmarcável": clicar no já selecionado limpa a seção.
                            if (s.mode === "single" && checked) {
                              e.preventDefault();
                              s.onToggle(o.value);
                            }
                          }}
                          className="h-4 w-4 shrink-0 accent-[#4F6930]"
                        />
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                        {o.count !== undefined && (
                          <span className="text-[11.5px] tabular-nums text-wg-ink-muted">{o.count}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-wg-border-lighter px-3 py-2">
            <button
              type="button"
              onClick={onClear}
              disabled={activeCount === 0}
              className={buttonVariants({ variant: "tertiary", size: "sm" })}
            >
              Limpar filtros
            </button>
            <button type="button" onClick={() => setOpen(false)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface ActiveChip {
  key: string;
  /** Ex.: "Status: Aberta". */
  label: string;
  onRemove: () => void;
}

/** Filtros ativos como chips removíveis + "Limpar filtros". Não renderiza nada se vazio. */
export function ActiveFilterChips({ chips, onClear }: { chips: ActiveChip[]; onClear: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-wg-border-light bg-white pl-2.5 pr-1 text-[12.5px] text-wg-ink-secondary"
        >
          {c.label}
          <button
            type="button"
            onClick={c.onRemove}
            aria-label={`Remover filtro ${c.label}`}
            className="flex h-5 w-5 items-center justify-center rounded-full text-wg-ink-muted hover:bg-wg-hover-light hover:text-wg-ink"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="ml-1 rounded-md px-1.5 py-1 text-[12.5px] font-semibold text-wg-green-dark hover:bg-wg-hover-light"
      >
        Limpar filtros
      </button>
    </div>
  );
}

/** Chips de filtro rápido (segmentos mutuamente exclusivos). */
export function QuickFilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
              active
                ? "border-wg-green bg-wg-green text-wg-dark"
                : "border-wg-border-light bg-white text-wg-ink-secondary hover:border-wg-green/60 hover:text-wg-ink"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("tabular-nums text-[12px]", active ? "text-wg-dark/70" : "text-wg-ink-muted")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
