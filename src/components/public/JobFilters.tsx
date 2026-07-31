"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";

const MODALITIES = [
  { value: "", label: "Todas as modalidades" },
  { value: "PRESENTIAL", label: "Presencial" },
  { value: "REMOTE", label: "Remoto" },
  { value: "HYBRID", label: "Híbrido" },
];

const ChevronDown = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9A9A9A"
    strokeWidth="2.5"
    style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const inputBase: React.CSSProperties = {
  width: "100%",
  background: "#1C1D1D",
  border: "1px solid #2A2A2A",
  color: "#F2F2F2",
  borderRadius: 999,
  fontSize: 14,
  outline: "none",
};

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
      debounceRef.current = setTimeout(() => updateFilter(key, value), 400);
    },
    [updateFilter]
  );

  const hasFilters = searchParams.size > 0;

  return (
    <div className="flex flex-wrap gap-3.5 mb-7">
      {/* Busca por cargo — sem chevron */}
      <input
        type="text"
        placeholder="Buscar cargo..."
        defaultValue={searchParams.get("query") || ""}
        onChange={(e) => updateFilterDebounced("query", e.target.value)}
        style={{ ...inputBase, flex: 1, minWidth: 200, padding: "14px 20px" }}
      />

      {/* Cidade — com chevron */}
      <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
        <input
          type="text"
          placeholder="Cidade..."
          defaultValue={searchParams.get("city") || ""}
          onChange={(e) => updateFilterDebounced("city", e.target.value)}
          style={{ ...inputBase, padding: "14px 40px 14px 20px" }}
        />
        <ChevronDown />
      </div>

      {/* Modalidade — select com chevron */}
      <div style={{ position: "relative", minWidth: 200 }}>
        <select
          defaultValue={searchParams.get("modality") || ""}
          onChange={(e) => updateFilter("modality", e.target.value)}
          style={{ ...inputBase, padding: "14px 40px 14px 20px", appearance: "none", cursor: "pointer" }}
        >
          {MODALITIES.map((m) => (
            <option key={m.value} value={m.value} style={{ background: "#1C1D1D", color: "#F2F2F2" }}>
              {m.label}
            </option>
          ))}
        </select>
        <ChevronDown />
      </div>

      {/* Área / departamento — com chevron */}
      <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
        <input
          type="text"
          placeholder="Área / departamento..."
          defaultValue={searchParams.get("department") || ""}
          onChange={(e) => updateFilterDebounced("department", e.target.value)}
          style={{ ...inputBase, padding: "14px 40px 14px 20px" }}
        />
        <ChevronDown />
      </div>

      {hasFilters && (
        <button
          onClick={() => router.push("/")}
          className="text-sm text-wg-green hover:text-wg-green-bright underline transition-colors self-center"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
