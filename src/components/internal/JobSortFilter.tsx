"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const SORT_OPTIONS = [
  { value: "date_desc", label: "Mais recentes" },
  { value: "date_asc", label: "Mais antigas" },
  { value: "city_asc", label: "Cidade (A-Z)" },
  { value: "state_asc", label: "Estado (A-Z)" },
  { value: "title_asc", label: "Título (A-Z)" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "ACTIVE", label: "Ativa" },
  { value: "PAUSED", label: "Pausada" },
  { value: "CLOSED", label: "Encerrada" },
];

function JobSortFilterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort") || "date_desc";
  const currentStatus = searchParams.get("status") || "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-wg-gray whitespace-nowrap">Ordenar por:</span>
        <select
          value={currentSort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="bg-wg-card border border-wg-border text-sm text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-wg-green/50 cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-wg-gray whitespace-nowrap">Status:</span>
        <select
          value={currentStatus}
          onChange={(e) => updateParam("status", e.target.value)}
          className="bg-wg-card border border-wg-border text-sm text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-wg-green/50 cursor-pointer"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {(currentSort !== "date_desc" || currentStatus !== "") && (
        <button
          onClick={() => router.push("?")}
          className="text-xs text-wg-gray hover:text-white transition-colors underline underline-offset-2"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

export function JobSortFilter() {
  return (
    <Suspense>
      <JobSortFilterInner />
    </Suspense>
  );
}
