"use client";

import { Columns3, GitCompareArrows, List, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { ActiveFilterChips, FilterPopover, type ActiveChip, type FilterSection } from "@/components/ui/FilterPopover";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SearchBar } from "@/components/internal/SearchBar";
import { SortDropdown } from "@/components/internal/SortDropdown";
import { cn } from "@/lib/utils";
import { MAX_COMPARE, SORT_OPTIONS, type CandidateSortKey } from "./types";

export type PipelineView = "kanban" | "list";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  filterSections: FilterSection[];
  activeFilterCount: number;
  activeChips: ActiveChip[];
  onClearFilters: () => void;
  sort: CandidateSortKey;
  onSortChange: (s: CandidateSortKey) => void;
  view: PipelineView;
  onViewChange: (v: PipelineView) => void;
  selectedCount: number;
  onCompare: () => void;
  onClearSelection: () => void;
  /** Quantos candidatos passam na busca/filtros (mostrado só quando há busca ou filtro). */
  resultCount: number | null;
}

/**
 * Barra única de trabalho: busca (ocupa o espaço livre), filtros, ordenação, Lista | Kanban
 * e comparação. Filtros ativos e seleção aparecem logo abaixo, como chips removíveis.
 */
export function CandidateToolbar({
  query,
  onQueryChange,
  filterSections,
  activeFilterCount,
  activeChips,
  onClearFilters,
  sort,
  onSortChange,
  view,
  onViewChange,
  selectedCount,
  onCompare,
  onClearSelection,
  resultCount,
}: Props) {
  const canCompare = selectedCount >= 2;
  const compareHint = canCompare
    ? `Comparar ${selectedCount} candidatos lado a lado`
    : `Selecione de 2 a ${MAX_COMPARE} candidatos (passe o mouse sobre o avatar ou use a caixa de seleção)`;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          value={query}
          onChange={onQueryChange}
          placeholder="Buscar por nome, e-mail, cargo ou cidade…"
          className="min-w-[220px] flex-1 basis-[280px]"
        />
        <FilterPopover sections={filterSections} activeCount={activeFilterCount} onClear={onClearFilters} />
        <SortDropdown value={sort} onChange={(v) => onSortChange(v as CandidateSortKey)} options={SORT_OPTIONS} />
        <SegmentedControl
          label="Modo de visualização"
          value={view}
          onChange={onViewChange}
          options={[
            { value: "list", label: "Lista", icon: List },
            { value: "kanban", label: "Kanban", icon: Columns3 },
          ]}
        />
        <span title={compareHint}>
          <button
            type="button"
            onClick={onCompare}
            disabled={!canCompare}
            aria-label={compareHint}
            className={buttonVariants({
              variant: "secondary",
              className: cn(canCompare && "border-wg-green-dark/50 bg-wg-sidebar text-wg-ink"),
            })}
          >
            <GitCompareArrows aria-hidden />
            {canCompare ? `Comparar ${selectedCount} candidatos` : "Comparar"}
          </button>
        </span>
      </div>

      {(activeChips.length > 0 || selectedCount > 0 || resultCount !== null) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {resultCount !== null && (
            <span className="text-meta text-wg-ink-muted" role="status">
              {resultCount === 1 ? "1 candidato encontrado" : `${resultCount} candidatos encontrados`}
            </span>
          )}
          <ActiveFilterChips chips={activeChips} onClear={onClearFilters} />
          {selectedCount > 0 && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-wg-sidebar pl-2.5 pr-1 text-[12.5px] font-medium text-wg-ink-secondary">
              {selectedCount} {selectedCount === 1 ? "selecionado" : "selecionados"} para comparar
              {selectedCount < 2 && <span className="text-wg-ink-muted">· escolha mais 1</span>}
              <button
                type="button"
                onClick={onClearSelection}
                aria-label="Limpar seleção"
                className="flex h-5 w-5 items-center justify-center rounded-full text-wg-ink-muted hover:bg-white hover:text-wg-ink"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
