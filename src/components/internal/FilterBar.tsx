"use client";

import { X } from "lucide-react";
import {
  JOB_STATUS_LABELS,
  MODALITY_LABELS,
  CONTRACT_TYPE_LABELS,
  JOB_PRIORITY_LABELS,
} from "@/lib/utils";
import type { JobFilters } from "@/types/jobs";

interface Props {
  filters: JobFilters;
  onChange: (patch: Partial<JobFilters>) => void;
  onClear: () => void;
  options: { cities: string[]; departments: string[]; managers: string[] };
  /** No Kanban as colunas SÃO os status — o filtro de status é ocultado. */
  showStatus?: boolean;
}

const selectClass =
  "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 transition-colors focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/40 cursor-pointer";

/** Converte um Record<value,label> em pares [value,label] preservando a ordem. */
function toPairs(map: Record<string, string>): [string, string][] {
  return Object.entries(map);
}

export function FilterBar({
  filters,
  onChange,
  onClear,
  options,
  showStatus = true,
}: Props) {
  const hasActive = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showStatus && (
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => onChange({ status: v })}
          options={toPairs(JOB_STATUS_LABELS)}
        />
      )}

      <FilterSelect
        label="Cidade"
        value={filters.city}
        onChange={(v) => onChange({ city: v })}
        options={options.cities.map((c) => [c, c])}
      />

      <FilterSelect
        label="Departamento"
        value={filters.department}
        onChange={(v) => onChange({ department: v })}
        options={options.departments.map((d) => [d, d])}
      />

      <FilterSelect
        label="Modelo"
        value={filters.modality}
        onChange={(v) => onChange({ modality: v })}
        options={toPairs(MODALITY_LABELS)}
      />

      <FilterSelect
        label="Contrato"
        value={filters.contractType}
        onChange={(v) => onChange({ contractType: v })}
        options={toPairs(CONTRACT_TYPE_LABELS)}
      />

      <FilterSelect
        label="Gestor"
        value={filters.responsible}
        onChange={(v) => onChange({ responsible: v })}
        options={options.managers.map((m) => [m, m])}
      />

      <FilterSelect
        label="Prioridade"
        value={filters.priority}
        onChange={(v) => onChange({ priority: v })}
        options={toPairs(JOB_PRIORITY_LABELS)}
      />

      {hasActive && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          <X className="h-3.5 w-3.5" />
          Limpar filtros
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const active = Boolean(value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={`${selectClass} ${active ? "border-wg-green/60 bg-wg-green/5 text-gray-900" : ""}`}
    >
      <option value="">{label}</option>
      {options.map(([val, lbl]) => (
        <option key={val} value={val}>
          {lbl}
        </option>
      ))}
    </select>
  );
}
