"use client";

import type { ElementType } from "react";
import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: ElementType;
}

interface Props<T extends string> {
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Rótulo do grupo para leitores de tela (ex.: "Modo de visualização"). */
  label: string;
  className?: string;
}

/**
 * Controle segmentado (ex.: Lista | Kanban): opções mutuamente exclusivas lado a lado,
 * com a ativa em "pílula" branca sobre trilho neutro. Mesma altura dos controles (36px).
 */
export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-0.5 rounded-control border border-wg-border-light bg-wg-bg p-0.5",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-[6px] px-2.5 text-[13px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
              active
                ? "bg-white text-wg-ink shadow-[0_1px_2px_rgba(26,34,19,.08)]"
                : "text-wg-ink-muted hover:text-wg-ink"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
