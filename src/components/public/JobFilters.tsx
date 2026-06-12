"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const MODALITIES = [
  { value: "", label: "Todas as modalidades" },
  { value: "PRESENTIAL", label: "Presencial" },
  { value: "REMOTE", label: "Remoto" },
  { value: "HYBRID", label: "Híbrido" },
];

export default function JobFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const hasFilters = searchParams.size > 0;

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <input
        type="text"
        placeholder="Cidade..."
        defaultValue={searchParams.get("city") || ""}
        onChange={(e) => updateFilter("city", e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 w-36"
      />

      <select
        defaultValue={searchParams.get("modality") || ""}
        onChange={(e) => updateFilter("modality", e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        {MODALITIES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Área / departamento..."
        defaultValue={searchParams.get("department") || ""}
        onChange={(e) => updateFilter("department", e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 w-48"
      />

      {hasFilters && (
        <button
          onClick={() => router.push("/")}
          className="text-sm text-orange-600 hover:text-orange-700 underline"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
