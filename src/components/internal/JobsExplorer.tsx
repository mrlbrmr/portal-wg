"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Users, List, LayoutGrid } from "lucide-react";
import {
  JOB_STATUS_LABELS,
  MODALITY_LABELS,
  JOB_PRIORITY_ORDER,
  STALE_JOB_DAYS,
  formatDate,
  formatAge,
  daysSince,
  isPublicJobStatus,
  normalizeText,
} from "@/lib/utils";
import { JobActionsMenu } from "@/components/internal/JobActionsMenu";
import { PriorityBadge } from "@/components/internal/PriorityBadge";
import { SearchBar } from "@/components/internal/SearchBar";
import { FilterBar } from "@/components/internal/FilterBar";
import { SortDropdown } from "@/components/internal/SortDropdown";
import { JobKanbanBoard } from "@/components/internal/JobKanbanBoard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { EMPTY_JOB_FILTERS, type JobRow, type JobFilters } from "@/types/jobs";

type View = "list" | "kanban";

interface Props {
  jobs: JobRow[];
  canManage: boolean;
  initialView?: View;
  initialStatus?: string;
  initialSort?: string;
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

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-wg-green/15 text-wg-green-dark",
  SCREENING: "bg-amber-100 text-amber-700",
  INTERVIEW: "bg-purple-100 text-purple-700",
  ADMISSION: "bg-cyan-100 text-cyan-700",
  PAUSED: "bg-orange-100 text-orange-700",
  CLOSED: "bg-gray-200 text-gray-600",
};

// Desempate estável: dentro do mesmo critério, mais recentes primeiro.
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
      return copy.sort(
        (a, b) => b.candidateCount - a.candidateCount || byNewest(a, b)
      );
    case "candidates_asc":
      return copy.sort(
        (a, b) => a.candidateCount - b.candidateCount || byNewest(a, b)
      );
    case "priority_desc":
      return copy.sort(
        (a, b) =>
          (JOB_PRIORITY_ORDER[b.priority] ?? 0) -
            (JOB_PRIORITY_ORDER[a.priority] ?? 0) || byNewest(a, b)
      );
    case "city_asc":
      return copy.sort((a, b) => a.city.localeCompare(b.city, "pt-BR"));
    case "state_asc":
      return copy.sort((a, b) => a.state.localeCompare(b.state, "pt-BR"));
    case "title_asc":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    case "date_desc":
    default:
      return copy.sort(byNewest);
  }
}

/** Valores únicos, não vazios e ordenados de um campo textual das vagas. */
function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );
}

export function JobsExplorer({
  jobs,
  canManage,
  initialView = "list",
  initialStatus = "",
  initialSort = "date_desc",
}: Props) {
  const [view, setView] = useState<View>(initialView);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<JobFilters>({
    ...EMPTY_JOB_FILTERS,
    status: initialStatus,
  });
  const [sort, setSort] = useState(
    SORT_OPTIONS.some((o) => o.value === initialSort) ? initialSort : "date_desc"
  );

  const query = useDebouncedValue(search, 300);

  // Opções dos filtros derivadas do conjunto de vagas (fonte única de verdade)
  const options = useMemo(
    () => ({
      cities: uniqueSorted(jobs.map((j) => j.city)),
      departments: uniqueSorted(jobs.map((j) => j.department)),
      managers: uniqueSorted(jobs.map((j) => j.responsible)),
    }),
    [jobs]
  );

  const filtered = useMemo(() => {
    const q = normalizeText(query);

    let result = jobs;

    // Pesquisa por título, cidade ou departamento
    if (q) {
      result = result.filter((job) => {
        const haystack = normalizeText(
          `${job.title} ${job.city} ${job.department ?? ""}`
        );
        return haystack.includes(q);
      });
    }

    // Filtros combináveis (AND). Status só na lista — no Kanban as colunas SÃO os status.
    if (view === "list" && filters.status) {
      result = result.filter((j) => j.status === filters.status);
    }
    if (filters.city) result = result.filter((j) => j.city === filters.city);
    if (filters.department)
      result = result.filter((j) => j.department === filters.department);
    if (filters.modality)
      result = result.filter((j) => j.modality === filters.modality);
    if (filters.contractType)
      result = result.filter((j) => j.contractType === filters.contractType);
    if (filters.responsible)
      result = result.filter((j) => j.responsible === filters.responsible);
    if (filters.priority)
      result = result.filter((j) => j.priority === filters.priority);

    return sortJobs(result, sort);
  }, [jobs, query, filters, sort, view]);

  return (
    <div className={view === "kanban" ? "" : "max-w-4xl"}>
      {/* Toolbar — linha 1: pesquisa, ordenação, visão */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Pesquisar por vaga, cidade ou departamento..."
          className="min-w-[240px] flex-1"
        />

        <SortDropdown value={sort} onChange={setSort} options={SORT_OPTIONS} />

        <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              view === "list"
                ? "bg-wg-green/15 text-wg-green-dark"
                : "text-gray-500 hover:text-gray-900"
            }`}
            title="Ver em lista"
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              view === "kanban"
                ? "bg-wg-green/15 text-wg-green-dark"
                : "text-gray-500 hover:text-gray-900"
            }`}
            title="Ver em Kanban por status"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </button>
        </div>

        <span className="text-xs text-gray-500">
          {filtered.length} {filtered.length === 1 ? "vaga" : "vagas"}
        </span>
      </div>

      {/* Toolbar — linha 2: filtros combináveis */}
      <div className="mb-4">
        <FilterBar
          filters={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onClear={() => setFilters(EMPTY_JOB_FILTERS)}
          options={options}
          showStatus={view === "list"}
        />
      </div>

      {/* Conteúdo */}
      {view === "kanban" ? (
        <JobKanbanBoard
          jobs={filtered.map((j) => ({
            id: j.id,
            title: j.title,
            city: j.city,
            state: j.state,
            modality: j.modality,
            status: j.status,
            priority: j.priority,
            createdAt: j.createdAt,
            candidateCount: j.candidateCount,
          }))}
          canManage={canManage}
        />
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-500">
          Nenhuma vaga encontrada.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((job) => (
            <div
              key={job.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-wg-green/50"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-gray-900">{job.title}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[job.status]}`}
                  >
                    {JOB_STATUS_LABELS[job.status]}
                  </span>
                  <PriorityBadge priority={job.priority} />
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                  <span>
                    {job.city} / {job.state}
                  </span>
                  <span>·</span>
                  <span>{MODALITY_LABELS[job.modality]}</span>
                  {job.department && (
                    <>
                      <span>·</span>
                      <span>{job.department}</span>
                    </>
                  )}
                  <span>·</span>
                  <span title={`Criada em ${formatDate(job.createdAt)}`}>
                    Criada {formatAge(job.createdAt)}
                  </span>
                  {isPublicJobStatus(job.status) &&
                    daysSince(job.createdAt) >= STALE_JOB_DAYS && (
                      <span className="font-medium text-amber-700">
                        · parada há {daysSince(job.createdAt)} dias
                      </span>
                    )}
                </div>
                {job.responsible && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-gray-500">👤 {job.responsible}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-shrink-0 items-center gap-3">
                <Link
                  href={`/vagas/${job.id}/candidatos`}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-wg-green hover:text-wg-green-dark"
                  title="Ver candidatos"
                >
                  <Users className="h-4 w-4" />
                  <span>{job.candidateCount}</span>
                </Link>
                {isPublicJobStatus(job.status) && (
                  <Link
                    href={`/vagas/${job.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 transition-colors hover:text-wg-green-dark"
                    title="Ver vaga pública"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                )}
                {canManage && (
                  <JobActionsMenu
                    jobId={job.id}
                    jobTitle={job.title}
                    status={job.status}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
