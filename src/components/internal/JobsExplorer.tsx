"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Users, Briefcase, SearchX, Plus, Search } from "lucide-react";
import {
  JOB_STATUS_LABELS,
  JOB_PRIORITY_ORDER,
  formatAge,
  isTerminalJobStatus,
  isKanbanDefaultHiddenStatus,
  normalizeText,
} from "@/lib/utils";
import { JobActionsMenu } from "@/components/internal/JobActionsMenu";
import { ViewToggle } from "@/components/internal/ViewToggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { type JobRow } from "@/types/jobs";
import { Skeleton } from "@/components/ui/Skeleton";

const JobKanbanBoard = dynamic(
  () =>
    import("@/components/internal/JobKanbanBoard").then((m) => m.JobKanbanBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex gap-4 overflow-hidden pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    ),
  }
);

type View = "list" | "kanban";
type QuickFilter = null | "minhas" | "urgentes" | "comCandidatos";

interface Props {
  jobs: JobRow[];
  canManage: boolean;
  initialView?: View;
  initialStatus?: string;
  initialSort?: string;
  currentUserName?: string | null;
}

const SORT_OPTIONS = [
  { value: "date_desc", label: "Mais recentes" },
  { value: "date_asc", label: "Mais antigas" },
  { value: "updated_desc", label: "Última atualização" },
  { value: "candidates_desc", label: "Mais candidatos" },
  { value: "candidates_asc", label: "Menos candidatos" },
  { value: "priority_desc", label: "Maior prioridade" },
  { value: "city_asc", label: "Cidade (A-Z)" },
  { value: "state_asc", label: "Estado (A-Z)" },
  { value: "title_asc", label: "Título (A-Z)" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "ACTIVE", label: "Ativa" },
  { value: "SCREENING", label: "Triagem" },
  { value: "INTERVIEW", label: "Entrevistas" },
  { value: "ADMISSION", label: "Admissão" },
  { value: "PAUSED", label: "Pausada" },
  { value: "CLOSED", label: "Cancelada" },
  { value: "FILLED", label: "Finalizada" },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT:     { bg: "#E9EDFA", color: "#3C56A8" },
  ACTIVE:    { bg: "#EAF4DC", color: "#4F6930" },
  SCREENING: { bg: "#FCF1DD", color: "#A0721E" },
  INTERVIEW: { bg: "#EAF4DC", color: "#4F6930" },
  ADMISSION: { bg: "#FCF1DD", color: "#A0721E" },
  PAUSED:    { bg: "#FCF1DD", color: "#A0721E" },
  CLOSED:    { bg: "#EFEFEF", color: "#6B7860" },
  FILLED:    { bg: "#EAF4DC", color: "#4F6930" },
};

const PRIORITY_STRIPE: Record<string, string> = {
  URGENT: "#D1503C",
  HIGH:   "#D9873C",
  MEDIUM: "#B9C2AA",
  LOW:    "#B9C2AA",
};

const PRIORITY_BADGE_INFO: Record<string, { label: string; color: string } | undefined> = {
  HIGH:   { label: "ALTA PRIORIDADE", color: "#D9873C" },
  URGENT: { label: "URGENTE", color: "#D1503C" },
};

function byNewest(a: JobRow, b: JobRow): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function sortJobs(jobs: JobRow[], sort: string): JobRow[] {
  const copy = [...jobs];
  switch (sort) {
    case "date_asc":
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "updated_desc":
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "candidates_desc":
      return copy.sort((a, b) => b.candidateCount - a.candidateCount || byNewest(a, b));
    case "candidates_asc":
      return copy.sort((a, b) => a.candidateCount - b.candidateCount || byNewest(a, b));
    case "priority_desc":
      return copy.sort(
        (a, b) =>
          (JOB_PRIORITY_ORDER[b.priority] ?? 0) - (JOB_PRIORITY_ORDER[a.priority] ?? 0) ||
          byNewest(a, b)
      );
    case "city_asc":
      return copy.sort((a, b) => (a.city ?? "").localeCompare(b.city ?? "", "pt-BR"));
    case "state_asc":
      return copy.sort((a, b) => (a.state ?? "").localeCompare(b.state ?? "", "pt-BR"));
    case "title_asc":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    default:
      return copy.sort(byNewest);
  }
}

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

function FilterCheckbox({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div
      className="px-2.5 py-2 rounded-lg text-wg-ink text-[13px] cursor-pointer flex items-center gap-2.5 hover:bg-[#F0F5E8]"
      onClick={onClick}
    >
      <span
        className="w-4 h-4 rounded flex items-center justify-center text-white text-[11px] shrink-0"
        style={{
          border: `1.5px solid ${active ? "#90CB46" : "#DCE8CC"}`,
          background: active ? "#90CB46" : "#fff",
        }}
      >
        {active ? "✓" : ""}
      </span>
      {label}
    </div>
  );
}

export function JobsExplorer({
  jobs,
  canManage,
  initialView = "list",
  initialStatus = "",
  initialSort = "date_desc",
  currentUserName,
}: Props) {
  const [view, setView] = useState<View>(initialView);
  const [search, setSearch] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>(
    initialStatus && STATUS_FILTER_OPTIONS.some((o) => o.value === initialStatus)
      ? [initialStatus]
      : []
  );
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [sort, setSort] = useState(
    SORT_OPTIONS.some((o) => o.value === initialSort) ? initialSort : "date_desc"
  );
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const query = useDebouncedValue(search, 300);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterMenuOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node))
        setSortMenuOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const toggleFilter = (key: string) =>
    setSelectedFilters((f) =>
      f.includes(key) ? f.filter((k) => k !== key) : [...f, key]
    );

  const options = useMemo(
    () => ({
      cities: uniqueSorted(jobs.map((j) => j.city)),
      departments: uniqueSorted(jobs.map((j) => j.department)),
    }),
    [jobs]
  );

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    let result = jobs;

    if (q) {
      result = result.filter((job) => {
        const haystack = normalizeText(
          `${job.title} ${job.city ?? ""} ${job.department ?? ""}`
        );
        return haystack.includes(q);
      });
    }

    // Status filter. Sem seleção manual: lista esconde vagas terminais
    // (Cancelada/Finalizada); Kanban esconde Pausada/Cancelada (Finalizada
    // continua visível lá). Com seleção manual, mostra só o que foi marcado —
    // vale para as duas views.
    const statusFilters = selectedFilters.filter((k) =>
      STATUS_FILTER_OPTIONS.some((o) => o.value === k)
    );
    if (statusFilters.length > 0) {
      result = result.filter((j) => statusFilters.includes(j.status));
    } else if (view === "list") {
      result = result.filter((j) => !isTerminalJobStatus(j.status));
    } else {
      result = result.filter((j) => !isKanbanDefaultHiddenStatus(j.status));
    }

    // Priority filter
    const priorityFilters = selectedFilters.filter((k) => k.startsWith("PRIORITY:"));
    if (priorityFilters.length > 0) {
      result = result.filter((j) => priorityFilters.includes(`PRIORITY:${j.priority}`));
    }

    // City filter
    const cityFilters = selectedFilters.filter((k) => k.startsWith("CITY:"));
    if (cityFilters.length > 0) {
      result = result.filter((j) => j.city && cityFilters.includes(`CITY:${j.city}`));
    }

    // Department filter
    const deptFilters = selectedFilters.filter((k) => k.startsWith("DEPT:"));
    if (deptFilters.length > 0) {
      result = result.filter(
        (j) => j.department && deptFilters.includes(`DEPT:${j.department}`)
      );
    }

    // Quick filter
    if (quickFilter === "minhas" && currentUserName) {
      result = result.filter((j) => j.responsible === currentUserName);
    } else if (quickFilter === "urgentes") {
      result = result.filter((j) => j.priority === "HIGH" || j.priority === "URGENT");
    } else if (quickFilter === "comCandidatos") {
      result = result.filter((j) => j.candidateCount > 0);
    }

    return sortJobs(result, sort);
  }, [jobs, query, selectedFilters, quickFilter, sort, view, currentUserName]);

  // Colunas exibidas no Kanban: por padrão, todas menos Pausada/Cancelada;
  // ao selecionar status no filtro "Etapa", mostra só as colunas marcadas.
  const kanbanVisibleStatuses = useMemo(() => {
    const statusFilters = selectedFilters.filter((k) =>
      STATUS_FILTER_OPTIONS.some((o) => o.value === k)
    );
    const allKeys = STATUS_FILTER_OPTIONS.map((o) => o.value);
    return statusFilters.length > 0
      ? allKeys.filter((s) => statusFilters.includes(s))
      : allKeys.filter((s) => !isKanbanDefaultHiddenStatus(s));
  }, [selectedFilters]);

  const activeFilterCount = selectedFilters.length;
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Mais recentes";

  return (
    <div className={view === "kanban" ? "" : "max-w-4xl"}>
      {/* Toolbar */}
      <div className="sticky top-14 z-30 mb-3 border-b border-wg-border-lighter bg-wg-bg pt-2 pb-3">
        {/* Row 1: search + filters + sort + toggle */}
        <div className="flex gap-3 items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-wg-ink-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por vaga, cidade ou departamento…"
              className="w-full bg-white border border-[#E7EEDD] rounded-[10px] pl-9 pr-3.5 py-2.5 text-wg-ink text-sm outline-none focus:border-wg-green transition-colors placeholder:text-wg-ink-muted"
            />
          </div>

          {/* Filtros dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => {
                setFilterMenuOpen((v) => !v);
                setSortMenuOpen(false);
              }}
              className="bg-white border border-[#E7EEDD] rounded-[10px] px-4 py-2.5 text-wg-ink-secondary text-sm font-medium whitespace-nowrap select-none hover:bg-wg-bg transition-colors"
            >
              {activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : "Filtros"} ▾
            </button>
            {filterMenuOpen && (
              <div className="absolute top-[calc(100%+6px)] left-0 bg-white border border-[#E7EEDD] rounded-[10px] shadow-[0_10px_28px_rgba(0,0,0,.1)] p-2 min-w-[220px] max-h-[420px] overflow-y-auto z-20">
                <div className="text-[#6B7860] text-[11px] tracking-[.06em] uppercase px-2.5 pt-1.5 pb-1">
                  Etapa
                </div>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <FilterCheckbox
                    key={opt.value}
                    label={opt.label}
                    active={selectedFilters.includes(opt.value)}
                    onClick={() => toggleFilter(opt.value)}
                  />
                ))}

                <div className="text-[#6B7860] text-[11px] tracking-[.06em] uppercase px-2.5 pt-2.5 pb-1">
                  Prioridade
                </div>
                <FilterCheckbox
                  label="Alta prioridade"
                  active={selectedFilters.includes("PRIORITY:HIGH")}
                  onClick={() => toggleFilter("PRIORITY:HIGH")}
                />
                <FilterCheckbox
                  label="Urgente"
                  active={selectedFilters.includes("PRIORITY:URGENT")}
                  onClick={() => toggleFilter("PRIORITY:URGENT")}
                />

                {options.cities.length > 0 && (
                  <>
                    <div className="text-[#6B7860] text-[11px] tracking-[.06em] uppercase px-2.5 pt-2.5 pb-1">
                      Cidade
                    </div>
                    {options.cities.map((city) => (
                      <FilterCheckbox
                        key={city}
                        label={city}
                        active={selectedFilters.includes(`CITY:${city}`)}
                        onClick={() => toggleFilter(`CITY:${city}`)}
                      />
                    ))}
                  </>
                )}

                {options.departments.length > 0 && (
                  <>
                    <div className="text-[#6B7860] text-[11px] tracking-[.06em] uppercase px-2.5 pt-2.5 pb-1">
                      Área
                    </div>
                    {options.departments.map((dept) => (
                      <FilterCheckbox
                        key={dept}
                        label={dept}
                        active={selectedFilters.includes(`DEPT:${dept}`)}
                        onClick={() => toggleFilter(`DEPT:${dept}`)}
                      />
                    ))}
                  </>
                )}

                {activeFilterCount > 0 && (
                  <div className="border-t border-[#EEF2E9] mt-1.5 pt-1.5">
                    <div
                      className="px-2.5 py-2 rounded-lg text-[#C4552E] text-[13px] cursor-pointer hover:bg-[#FDF1EE]"
                      onClick={() => setSelectedFilters([])}
                    >
                      Limpar filtros
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ordenar dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              type="button"
              onClick={() => {
                setSortMenuOpen((v) => !v);
                setFilterMenuOpen(false);
              }}
              className="bg-white border border-[#E7EEDD] rounded-[10px] px-4 py-2.5 text-wg-ink-secondary text-sm font-medium whitespace-nowrap select-none hover:bg-wg-bg transition-colors"
            >
              Ordenar: {currentSortLabel} ▾
            </button>
            {sortMenuOpen && (
              <div className="absolute top-[calc(100%+6px)] left-0 bg-white border border-[#E7EEDD] rounded-[10px] shadow-[0_10px_28px_rgba(0,0,0,.1)] p-1.5 min-w-[190px] z-20">
                {SORT_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    className={`px-3 py-2 rounded-lg text-[13px] cursor-pointer hover:bg-[#F0F5E8] ${
                      sort === opt.value
                        ? "text-wg-ink font-semibold"
                        : "text-[#2E3A26]"
                    }`}
                    onClick={() => {
                      setSort(opt.value);
                      setSortMenuOpen(false);
                    }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista / Kanban toggle */}
          <ViewToggle view={view} onChange={setView} />
        </div>

        {/* Row 2: quick-filter chips */}
        <div className="flex gap-2 items-center mt-2.5 flex-wrap">
          {(
            [
              { key: null, label: "Todas" },
              { key: "minhas", label: "Minhas Vagas" },
              { key: "urgentes", label: "Urgentes" },
              { key: "comCandidatos", label: "Com Candidatos" },
            ] as const
          ).map((c) => {
            const active = quickFilter === c.key;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setQuickFilter(c.key)}
                className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all"
                style={{
                  background: active ? "#90CB46" : "#fff",
                  color: active ? "#0C0D0C" : "#3E4A34",
                  border: `1px solid ${active ? "#90CB46" : "#E7EEDD"}`,
                }}
              >
                {c.label}
              </button>
            );
          })}
          <span className="text-[#6B7860] text-[12.5px] ml-auto">
            {filtered.length} de {jobs.length} vagas
          </span>
        </div>
      </div>

      {/* Content */}
      {view === "kanban" ? (
        <JobKanbanBoard
          jobs={filtered.map((j) => ({
            id: j.id,
            title: j.title,
            city: j.city,
            state: j.state,
            isTalentPool: j.isTalentPool,
            modality: j.modality,
            status: j.status,
            priority: j.priority,
            createdAt: j.createdAt,
            lastActivityAt: j.lastActivityAt,
            candidateCount: j.candidateCount,
          }))}
          visibleStatuses={kanbanVisibleStatuses}
          canManage={canManage}
        />
      ) : filtered.length === 0 ? (
        jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Nenhuma vaga cadastrada"
            description="Crie a primeira vaga para começar a receber candidaturas."
            action={
              canManage ? (
                <Link
                  href="/vagas/nova"
                  className="inline-flex items-center gap-2 rounded-lg bg-wg-green px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-wg-green-bright"
                >
                  <Plus className="h-4 w-4" />
                  Nova vaga
                </Link>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title="Nenhuma vaga encontrada"
            description="Nenhuma vaga corresponde à pesquisa e aos filtros atuais."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedFilters([]);
                  setQuickFilter(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7EEDD] px-3 py-2 text-sm font-medium text-wg-ink-secondary transition-colors hover:border-wg-green hover:text-wg-green-dark"
              >
                Limpar pesquisa e filtros
              </button>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((job) => {
            const stripeColor = PRIORITY_STRIPE[job.priority] ?? "#B9C2AA";
            const statusStyle = STATUS_STYLE[job.status] ?? { bg: "#EFEFEF", color: "#6B7860" };
            const priorityInfo = PRIORITY_BADGE_INFO[job.priority];
            const location = job.isTalentPool
              ? "Todas as praças"
              : [job.city, job.state].filter(Boolean).join("/") || "—";
            const meta = [location, job.department, `Criada ${formatAge(job.createdAt)}`]
              .filter(Boolean)
              .join(" · ");

            return (
              <div
                key={job.id}
                className="group bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,.05)] flex hover:shadow-[0_8px_22px_rgba(0,0,0,.08)] transition-shadow"
              >
                {/* Priority stripe — arredondada para não precisar de overflow-hidden no card */}
                <div className="w-[5px] shrink-0 rounded-l-2xl" style={{ background: stripeColor }} />

                <div className="flex-1 px-5 py-4 flex justify-between items-center gap-4 min-w-0">
                  {/* Left: job info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-wg-ink text-base font-bold">{job.title}</span>
                      <span
                        className="text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        {JOB_STATUS_LABELS[job.status] ?? job.status}
                      </span>
                      {priorityInfo && (
                        <span
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0"
                          style={{
                            border: `1.5px solid ${priorityInfo.color}`,
                            color: priorityInfo.color,
                          }}
                        >
                          ⚠ {priorityInfo.label}
                        </span>
                      )}
                    </div>
                    <div className="text-wg-ink-muted text-[13px] mt-1.5">{meta}</div>
                  </div>

                  {/* Right: hover actions + candidate count + menu */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Hover-reveal action */}
                    <div className="flex gap-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                      <Link
                        href={`/vagas/${job.id}/candidatos`}
                        className="bg-[#F0F5E8] text-[#3E5A2A] px-3 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap hover:bg-[#E4EED6] transition-colors"
                      >
                        Ver candidatos
                      </Link>
                    </div>

                    {/* Candidate count */}
                    <div className="text-right shrink-0 min-w-[56px]">
                      <div className="text-wg-ink text-lg font-extrabold flex items-center gap-1 justify-end">
                        <Users className="w-4 h-4 text-wg-ink-muted" />
                        {job.candidateCount}
                      </div>
                      <div className="text-[#6B7860] text-[11px]">
                        {job.candidateCount === 1 ? "candidato" : "candidatos"}
                      </div>
                    </div>

                    {/* Actions menu (⋯) */}
                    {canManage && (
                      <JobActionsMenu
                        jobId={job.id}
                        jobTitle={job.title}
                        status={job.status}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
