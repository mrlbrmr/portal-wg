"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Users, List, LayoutGrid } from "lucide-react";
import {
  JOB_STATUS_LABELS,
  MODALITY_LABELS,
  formatDate,
  isPublicJobStatus,
  normalizeText,
} from "@/lib/utils";
import { JobActions } from "@/components/internal/JobActions";
import { DuplicateJobButton } from "@/components/internal/DuplicateJobButton";
import { SearchBar } from "@/components/internal/SearchBar";
import { JobKanbanBoard } from "@/components/internal/JobKanbanBoard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { JobRow } from "@/types/jobs";

type View = "list" | "kanban";

interface Props {
  jobs: JobRow[];
  canManage: boolean;
  initialView?: View;
  initialStatus?: string;
  initialSort?: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "DRAFT", label: "Rascunho" },
  { value: "ACTIVE", label: "Ativa" },
  { value: "SCREENING", label: "Triagem" },
  { value: "INTERVIEW", label: "Entrevistas" },
  { value: "ADMISSION", label: "Admissão" },
  { value: "PAUSED", label: "Pausada" },
  { value: "CLOSED", label: "Cancelada" },
];

const SORT_OPTIONS = [
  { value: "date_desc", label: "Mais recentes" },
  { value: "date_asc", label: "Mais antigas" },
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

const selectClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/40 cursor-pointer";

function sortJobs(jobs: JobRow[], sort: string): JobRow[] {
  const copy = [...jobs];
  switch (sort) {
    case "date_asc":
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "city_asc":
      return copy.sort((a, b) => a.city.localeCompare(b.city, "pt-BR"));
    case "state_asc":
      return copy.sort((a, b) => a.state.localeCompare(b.state, "pt-BR"));
    case "title_asc":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    case "date_desc":
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
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
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState(
    SORT_OPTIONS.some((o) => o.value === initialSort) ? initialSort : "date_desc"
  );

  const query = useDebouncedValue(search, 300);

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

    // Filtro de status — no Kanban as colunas SÃO os status, então não aplica.
    if (view === "list" && status) {
      result = result.filter((job) => job.status === status);
    }

    return sortJobs(result, sort);
  }, [jobs, query, status, sort, view]);

  return (
    <div className={view === "kanban" ? "" : "max-w-4xl"}>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Pesquisar por vaga, cidade ou departamento..."
          className="min-w-[240px] flex-1"
        />

        {view === "list" && (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={selectClass}
            aria-label="Filtrar por status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className={selectClass}
          aria-label="Ordenar por"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Alternador Lista / Kanban */}
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
                  <span>Criada em {formatDate(job.createdAt)}</span>
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
                  <>
                    <Link
                      href={`/vagas/${job.id}/editar`}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-wg-green hover:text-wg-green-dark"
                    >
                      Editar
                    </Link>
                    <DuplicateJobButton jobId={job.id} jobTitle={job.title} />
                    <JobActions
                      jobId={job.id}
                      jobTitle={job.title}
                      status={job.status}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
