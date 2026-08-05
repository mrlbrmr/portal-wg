"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export interface AdmissionRow {
  id: string;
  fullName: string;
  cpf: string | null;
  positionName: string | null;
  companyId: string | null;
  companyName: string | null;
  branchName: string | null;
  stageId: string | null;
  stageName: string | null;
  stageColor: string | null;
  responsibleName: string | null;
  startDate: string | null;     // "DD/MM/YYYY" para exibição
  startDateISO: string | null;  // "YYYY-MM-DD" para filtro/ordenação
  createdAt: string;            // ISO para ordenação
  checklistDone: number;
  checklistTotal: number;
}

interface Option {
  id: string;
  name: string;
}

interface Props {
  rows: AdmissionRow[];
  stages: Option[];
  companies: Option[];
  positions: Option[];
}

type SortKey = "recent" | "oldest" | "nameAZ" | "nameZA" | "startAsc" | "startDesc" | "stage";
type QuickFilter = null | "atrasadas" | "proximas";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent",    label: "Mais recentes" },
  { value: "oldest",    label: "Mais antigas" },
  { value: "nameAZ",   label: "Nome A→Z" },
  { value: "nameZA",   label: "Nome Z→A" },
  { value: "startAsc", label: "Início ↑" },
  { value: "startDesc",label: "Início ↓" },
  { value: "stage",    label: "Por etapa" },
];

function daysFrom(iso: string, today: Date): number {
  const start = new Date(iso + "T00:00:00");
  return Math.round((start.getTime() - today.getTime()) / 86400000);
}

function countdownLabel(days: number): string {
  if (days > 0) return `Em ${days}d`;
  if (days === 0) return "Hoje";
  return `Atrasado ${-days}d`;
}

function FilterCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#F3F7EC] cursor-pointer select-none">
      <div
        className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors"
        style={
          checked
            ? { background: "#90CB46", borderColor: "#90CB46" }
            : { background: "white", borderColor: "#C4D4AA" }
        }
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-[13px] text-[#1A2213]">{label}</span>
    </label>
  );
}

export function AdmissionsExplorer({ rows, stages, companies }: Props) {
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { todayDate, in7Date } = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const in7Date = new Date(todayDate.getTime() + 7 * 86400000);
    return { todayDate, in7Date };
  }, []);

  const stageFilters = useMemo(
    () => selectedFilters.filter((k) => k.startsWith("STAGE:")).map((k) => k.slice(6)),
    [selectedFilters]
  );
  const compFilters = useMemo(
    () => selectedFilters.filter((k) => k.startsWith("CO:")).map((k) => k.slice(3)),
    [selectedFilters]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (q && !`${r.fullName} ${r.cpf ?? ""}`.toLowerCase().includes(q)) return false;
        if (stageFilters.length > 0 && !stageFilters.includes(r.stageId ?? "")) return false;
        if (compFilters.length > 0 && !compFilters.includes(r.companyId ?? "")) return false;
        if (quickFilter === "atrasadas") {
          if (!r.startDateISO) return false;
          const days = daysFrom(r.startDateISO, todayDate);
          if (days >= 0) return false;
        }
        if (quickFilter === "proximas") {
          if (!r.startDateISO) return false;
          const start = new Date(r.startDateISO + "T00:00:00");
          if (start < todayDate || start > in7Date) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortKey) {
          case "recent":    return b.createdAt.localeCompare(a.createdAt);
          case "oldest":    return a.createdAt.localeCompare(b.createdAt);
          case "nameAZ":    return a.fullName.localeCompare(b.fullName, "pt-BR");
          case "nameZA":    return b.fullName.localeCompare(a.fullName, "pt-BR");
          case "startAsc":  return (a.startDateISO ?? "").localeCompare(b.startDateISO ?? "");
          case "startDesc": return (b.startDateISO ?? "").localeCompare(a.startDateISO ?? "");
          case "stage":     return (a.stageName ?? "").localeCompare(b.stageName ?? "", "pt-BR");
          default:          return 0;
        }
      });
  }, [rows, query, stageFilters, compFilters, quickFilter, sortKey, todayDate, in7Date]);

  function toggleFilter(key: string) {
    setSelectedFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const activeFilterCount = selectedFilters.length;
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? "Recentes";

  const QUICK_CHIPS: { key: QuickFilter; label: string }[] = [
    { key: null,        label: "Todas" },
    { key: "atrasadas", label: "Atrasadas" },
    { key: "proximas",  label: "Próximos 7 dias" },
  ];

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-[#E7EEDD] rounded-2xl shadow-sm">
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhuma admissão ainda"
          description="Cadastre a primeira admissão para começar a acompanhar o onboarding."
          action={
            <Link
              href="/admissoes/nova"
              className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-semibold px-4 py-2 rounded-full text-sm transition-colors"
            >
              Nova admissão
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A9B7A]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou CPF…"
            className="w-full bg-white border border-[#DCE8CC] rounded-xl pl-9 pr-3 py-2 text-[13.5px] text-[#1A2213] placeholder:text-[#8A9B7A] focus:outline-none focus:ring-2 focus:ring-wg-green/30 focus:border-wg-green transition-colors"
          />
        </div>

        {/* Filtros dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            type="button"
            onClick={() => { setFilterMenuOpen((v) => !v); setSortMenuOpen(false); }}
            className={`inline-flex items-center gap-2 border rounded-xl px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
              activeFilterCount > 0
                ? "bg-[#EAF4DC] border-[#90CB46] text-[#3E5A2A]"
                : "bg-white border-[#DCE8CC] text-[#55614A] hover:border-[#90CB46]"
            }`}
          >
            Filtros
            {activeFilterCount > 0 && (
              <span className="bg-[#90CB46] text-[#0C0D0C] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {filterMenuOpen && (
            <div className="absolute top-full mt-1.5 left-0 z-30 bg-white border border-[#DCE8CC] rounded-2xl shadow-xl py-2 min-w-[220px] max-h-80 overflow-y-auto">
              {stages.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10.5px] font-bold text-[#8A9B7A] uppercase tracking-wider">
                    Etapa
                  </div>
                  {stages.map((s) => (
                    <FilterCheckbox
                      key={s.id}
                      checked={selectedFilters.includes(`STAGE:${s.id}`)}
                      onChange={() => toggleFilter(`STAGE:${s.id}`)}
                      label={s.name}
                    />
                  ))}
                </>
              )}
              {companies.length > 0 && (
                <>
                  <div className="px-3 py-1.5 mt-1 text-[10.5px] font-bold text-[#8A9B7A] uppercase tracking-wider">
                    Empresa
                  </div>
                  {companies.map((c) => (
                    <FilterCheckbox
                      key={c.id}
                      checked={selectedFilters.includes(`CO:${c.id}`)}
                      onChange={() => toggleFilter(`CO:${c.id}`)}
                      label={c.name}
                    />
                  ))}
                </>
              )}
              {activeFilterCount > 0 && (
                <div className="px-3 pt-2 mt-1 border-t border-[#E7EEDD]">
                  <button
                    onClick={() => { setSelectedFilters([]); setFilterMenuOpen(false); }}
                    className="text-[12.5px] font-semibold text-[#C4552E] hover:underline"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ordenar dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            type="button"
            onClick={() => { setSortMenuOpen((v) => !v); setFilterMenuOpen(false); }}
            className="inline-flex items-center gap-2 bg-white border border-[#DCE8CC] rounded-xl px-3.5 py-2 text-[13.5px] text-[#55614A] hover:border-[#90CB46] transition-colors"
          >
            <span>
              Ordenar: <span className="font-semibold text-[#1A2213]">{currentSortLabel}</span>
            </span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {sortMenuOpen && (
            <div className="absolute top-full mt-1.5 right-0 z-30 bg-white border border-[#DCE8CC] rounded-2xl shadow-xl py-2 min-w-[180px]">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { setSortKey(o.value); setSortMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-[13px] transition-colors ${
                    sortKey === o.value
                      ? "font-semibold text-[#1A2213] bg-[#F3F7EC]"
                      : "text-[#55614A] hover:bg-[#F8FBF4]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista / Kanban toggle */}
        <div className="bg-[#EEF4E3] rounded-[10px] p-1 flex gap-0.5 shrink-0 ml-auto">
          <span className="px-3.5 py-1.5 rounded-lg text-[13px] font-bold bg-white text-[#1A2213] shadow-sm">
            Lista
          </span>
          <Link
            href="/admissoes/kanban"
            className="px-3.5 py-1.5 rounded-lg text-[13px] font-bold text-[#55614A] hover:text-[#1A2213] transition-colors"
          >
            Kanban
          </Link>
        </div>
      </div>

      {/* Quick filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {QUICK_CHIPS.map((c) => {
          const active = quickFilter === c.key;
          return (
            <button
              key={String(c.key)}
              type="button"
              onClick={() => setQuickFilter(active ? null : c.key)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[#90CB46] text-[#0C0D0C]"
                  : "bg-white border border-[#DCE8CC] text-[#55614A] hover:border-[#90CB46]"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhum resultado"
          description="Nenhuma admissão corresponde aos filtros aplicados."
          action={
            activeFilterCount > 0 ? (
              <button
                onClick={() => setSelectedFilters([])}
                className="text-sm font-medium text-wg-green-dark hover:underline"
              >
                Limpar filtros
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const days = r.startDateISO ? daysFrom(r.startDateISO, todayDate) : null;
            const stripeColor = r.stageColor ?? "#B9C2AA";
            const badgeBg = r.stageColor ? r.stageColor + "1f" : "#F0F3EC";
            const company = [r.companyName, r.branchName].filter(Boolean).join(" · ");
            const meta = [r.positionName, company, r.responsibleName].filter(Boolean).join(" · ");
            const countdownColor =
              days === null ? "#55614A"
              : days < 0   ? "#C4552E"
              : days === 0 ? "#A0721E"
              :              "#4F6930";

            return (
              <div
                key={r.id}
                className="group bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,.05)] flex overflow-hidden hover:shadow-[0_8px_22px_rgba(0,0,0,.08)] transition-shadow"
              >
                <div className="w-[5px] shrink-0" style={{ background: stripeColor }} />
                <div className="flex-1 px-5 py-4 flex justify-between items-start gap-4 min-w-0">
                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        href={`/admissoes/${r.id}`}
                        className="text-[#1A2213] font-bold text-base hover:text-[#4F6930] transition-colors"
                      >
                        {r.fullName}
                      </Link>
                      {r.stageName && (
                        <span
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: badgeBg, color: stripeColor }}
                        >
                          {r.stageName.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {meta && (
                      <div className="text-[#55614A] text-[12.5px] mt-1 truncate">{meta}</div>
                    )}
                    {r.checklistTotal > 0 && (
                      <div className="flex items-center gap-2 mt-2.5 max-w-[360px]">
                        <div className="flex-1 h-1.5 bg-[#EEF2E9] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round((r.checklistDone / r.checklistTotal) * 100)}%`,
                              background: stripeColor,
                            }}
                          />
                        </div>
                        <span className="text-[#3E4A34] text-xs font-semibold whitespace-nowrap">
                          {Math.round((r.checklistDone / r.checklistTotal) * 100)}% · {r.checklistDone}/{r.checklistTotal}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {r.startDate && (
                      <span
                        className="text-[11.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{
                          background: days !== null && days < 0 ? "#FBE6E1" : "#F0F3EC",
                          color: countdownColor,
                        }}
                      >
                        📅 Início {r.startDate}
                        {days !== null && ` · ${countdownLabel(days)}`}
                      </span>
                    )}
                    <div className="flex gap-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                      <Link
                        href={`/admissoes/${r.id}`}
                        className="bg-[#F0F5E8] text-[#3E5A2A] px-3 py-1.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap hover:bg-[#E4EED6] transition-colors"
                      >
                        Ver checklist
                      </Link>
                      <Link
                        href={`/admissoes/${r.id}/editar`}
                        className="bg-white text-[#3E4A34] border border-[#E7EEDD] px-3 py-1.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap hover:bg-[#EEF2E9] transition-colors"
                      >
                        Editar
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[#8A9B7A]">
        {filtered.length} de {rows.length} admiss{rows.length === 1 ? "ão" : "ões"}
      </p>
    </div>
  );
}
