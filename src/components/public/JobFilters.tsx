"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";

const MODALITIES = [
  { value: "", label: "Todas as modalidades" },
  { value: "PRESENTIAL", label: "Presencial" },
  { value: "REMOTE", label: "Remoto" },
  { value: "HYBRID", label: "Híbrido" },
];

const inputClass =
  "bg-wg-card border border-wg-border rounded-full px-4 py-2 text-sm text-white placeholder:text-wg-gray focus:outline-none focus:border-wg-green transition-colors";

export default function JobFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams]
  );

  const updateFilterDebounced = useCallback(
    (key: string, value: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateFilter(key, value);
      }, 500);
    },
    [updateFilter]
  );

  const hasFilters = searchParams.size > 0;

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <input
        type="text"
        placeholder="Cidade..."
        defaultValue={searchParams.get("city") || ""}
        onChange={(e) => updateFilterDebounced("city", e.target.value)}
        className={`${inputClass} w-36`}
      />

      <select
        defaultValue={searchParams.get("modality") || ""}
        onChange={(e) => updateFilter("modality", e.target.value)}
        className={`${inputClass} bg-wg-card`}
      >
        {MODALITIES.map((m) => (
          <option key={m.value} value={m.value} className="bg-wg-card text-white">
            {m.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Área / departamento..."
        defaultValue={searchParams.get("department") || ""}
        onChange={(e) => updateFilterDebounced("department", e.target.value)}
        className={`${inputClass} w-48`}
      />

      {hasFilters && (
        <button
          onClick={() => router.push("/")}
          className="text-sm text-wg-green hover:text-wg-green-bright underline transition-colors"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
