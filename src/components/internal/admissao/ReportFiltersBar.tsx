"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/ui/FilterControls";
import {
  activeReportFilterCount,
  EMPTY_REPORT_FILTERS,
  REPORT_PERIODS,
  reportFiltersToQuery,
  type ReportFilters,
  type ReportPeriod,
  type ReportStatus,
} from "@/lib/admissao/reports";

interface Option {
  id: string;
  name: string;
}

/**
 * Filtros globais dos Relatórios. Cada mudança vai para a URL e o servidor recalcula
 * indicadores, gráficos e alertas (e a exportação usa o mesmo recorte).
 */
export function ReportFiltersBar({
  filters,
  companies,
  branches,
  positions,
  users,
}: {
  filters: ReportFilters;
  companies: Option[];
  branches: Option[];
  positions: Option[];
  users: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function apply(next: ReportFilters) {
    const qs = reportFiltersToQuery(next);
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  const set = <K extends keyof ReportFilters>(k: K) => (v: ReportFilters[K]) => apply({ ...filters, [k]: v });
  const opts = (list: Option[], all = "Todas") => [{ value: "", label: all }, ...list.map((o) => ({ value: o.id, label: o.name }))];

  return (
    <FilterBar
      activeCount={activeReportFilterCount(filters)}
      onClear={() => apply(EMPTY_REPORT_FILTERS)}
      trailing={
        pending ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-meta text-wg-ink-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Atualizando…
          </span>
        ) : null
      }
      search={
        <FilterSelect<ReportPeriod>
          label="Período"
          value={filters.period}
          onChange={set("period")}
          options={REPORT_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
        />
      }
    >
      <FilterSelect label="Empresa" value={filters.company} onChange={set("company")} options={opts(companies)} />
      <FilterSelect label="Filial" value={filters.branch} onChange={set("branch")} options={opts(branches)} />
      <FilterSelect label="Cargo" value={filters.position} onChange={set("position")} options={opts(positions, "Todos")} />
      <FilterSelect
        label="Responsável"
        value={filters.responsible}
        onChange={set("responsible")}
        options={[...opts(users, "Todos"), { value: "none", label: "Sem responsável" }]}
      />
      <FilterSelect<ReportStatus>
        label="Situação"
        value={filters.status}
        onChange={set("status")}
        options={[
          { value: "", label: "Todas" },
          { value: "ativas", label: "Em andamento" },
          { value: "concluidas", label: "Concluídas" },
        ]}
      />
    </FilterBar>
  );
}
