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
      <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Ordenar por"
        className="cursor-pointer rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 transition-colors focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/40"
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
