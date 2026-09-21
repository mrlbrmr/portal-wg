"use client";

import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Campo de pesquisa controlado e reutilizável. O debounce fica a cargo
 * de quem consome (ex.: via useDebouncedValue), mantendo este componente
 * puramente apresentacional.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Pesquisar...",
  className = "",
}: Props) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wg-ink-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-control border border-wg-border-light bg-white pl-9 pr-9 text-sm text-wg-ink placeholder:text-wg-ink-muted/80 transition-colors focus:border-wg-green-dark focus:outline-none focus:ring-2 focus:ring-wg-green/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar pesquisa"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
