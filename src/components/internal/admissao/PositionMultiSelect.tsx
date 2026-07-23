"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

interface Position {
  id: string;
  name: string;
}

interface Props {
  positions: Position[];
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

/**
 * Multi-seleção de cargos. Seleção vazia = "Todos os cargos" (aplica a todos).
 * Um ou mais selecionados = o modelo vale só para aqueles cargos.
 */
export function PositionMultiSelect({ positions, value, onChange, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const label =
    value.length === 0
      ? "Todos os cargos"
      : value.length === 1
        ? positions.find((p) => p.id === value[0])?.name ?? "1 cargo"
        : `${value.length} cargos`;

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green"
        title={value.length > 1 ? positions.filter((p) => value.includes(p.id)).map((p) => p.name).join(", ") : undefined}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full min-w-[200px] overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
          >
            <span className={value.length === 0 ? "font-medium text-gray-900" : "text-gray-600"}>
              Todos os cargos
            </span>
            {value.length === 0 && <Check className="w-4 h-4 text-wg-green shrink-0" />}
          </button>
          <div className="my-1 border-t border-gray-100" />
          {positions.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-gray-400">Nenhum cargo cadastrado.</p>
          )}
          {positions.map((p) => {
            const checked = value.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                <span className={checked ? "font-medium text-gray-900" : "text-gray-700"}>{p.name}</span>
                {checked && <Check className="w-4 h-4 text-wg-green shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
