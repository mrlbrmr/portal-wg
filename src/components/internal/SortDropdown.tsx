"use client";

import { ArrowUpDown } from "lucide-react";

export interface SortOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  className?: string;
}

/** Dropdown de ordenação reutilizável (com ícone). */
export function SortDropdown({ value, onChange, options, className = "" }: Props) {
  return (
    <div className={`relative ${className}`}>
      <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wg-ink-muted" aria-hidden />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Ordenar por"
        className="h-9 cursor-pointer rounded-control border border-wg-border-light bg-white pl-8 pr-8 text-sm font-medium text-wg-ink-secondary transition-colors hover:bg-wg-bg focus:border-wg-green-dark focus:outline-none focus:ring-2 focus:ring-wg-green/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
