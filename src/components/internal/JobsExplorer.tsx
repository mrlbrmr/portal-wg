"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, SearchX, Plus, Users } from "lucide-react";
import { normalizeText } from "@/lib/utils";
import {
  JOB_LIFECYCLE_META,
  jobLifecycle,
  parseLegacyStatusParam,
  type JobLifecycle,
} from "@/lib/recruitment/job-presentation";
import { jobAttentionReasons, attentionScore } from "@/lib/recruitment/attention";
import { JobListItem, type JobListRow } from "@/components/internal/job/JobListItem";
import { SearchBar } from "@/components/internal/SearchBar";
import { SortDropdown } from "@/components/internal/SortDropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink, Button } from "@/components/ui/Button";
import {
  FilterPopover,
  ActiveFilterChips,
  QuickFilterChips,
  type ActiveChip,
  type FilterSection,
} from "@/components/ui/FilterPopover";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSyncQueryString, parseList } from "@/hooks/useSyncQueryString";
import { type JobRow } from "@/types/jobs";
import type { JobRequestReason } from "@/types/domain";
import { JOB_REQUEST_REASON_LABELS, JOB_REQUEST_REASON_ORDER } from "@/lib/job-requests/constants";

// Vagas são acompanhadas só em lista; o status muda por ações explícitas (menu da vaga, posições,
// solicitação). Kanban existe apenas no ATS — o pipeline de candidatos dentro de cada vaga.
type Quick = "todas" | "atencao" | "triagem";
type CandidatesFilter = "" | "com" | "sem";
type PeriodFilter = "" | "7" | "30" | "90";

interface Props {
  jobs: JobRow[];
  canManage: boolean;
  /** Query string da página — fonte do estado inicial dos filtros (persistência por URL). */
  initialParams: Record<string, string | undefined>;
}

const SORT_OPTIONS = [
  { value: "date_desc", label: "Mais recentes" },
  { value: "date_asc", label: "Mais antigas" },
  { value: "attention", label: "Mais urgentes" },
  { value: "updated_desc", label: "Movimentação recente" },
  { value: "candidates_desc", label: "Mais candidatos" },
  { value: "candidates_asc", label: "Menos candidatos" },
  { value: "city_asc", label: "Cidade (A-Z)" },
  { value: "title_asc", label: "Título (A-Z)" },
];

const CANDIDATES_LABEL: Record<Exclude<CandidatesFilter, "">, string> = { com: "Com candidatos", sem: "Sem candidatos" };
const PERIOD_LABEL: Record<Exclude<PeriodFilter, "">, string> = {
  "7": "Abertas nos últimos 7 dias",
  "30": "Abertas nos últimos 30 dias",
  "90": "Abertas nos últimos 90 dias",
};

type Enriched = JobListRow;

function sortJobs(jobs: Enriched[], sort: string): Enriched[] {
  const byNewest = (a: Enriched, b: Enriched) => b.createdAt.localeCompare(a.createdAt);
  const copy = [...jobs];
  switch (sort) {
    case "date_asc":
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "attention":
      return copy.sort((a, b) => attentionScore(b.reasons) - attentionScore(a.reasons) || byNewest(a, b));
    case "updated_desc":
      return copy.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    case "candidates_desc":
      return copy.sort((a, b) => b.candidateCount - a.candidateCount || byNewest(a, b));
    case "candidates_asc":
      return copy.sort((a, b) => a.candidateCount - b.candidateCount || byNewest(a, b));
    case "city_asc":
      return copy.sort((a, b) => (a.city ?? "").localeCompare(b.city ?? "", "pt-BR"));
    case "title_asc":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    default:
      return copy.sort(byNewest);
  }
}

function countBy(values: (string | null)[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

function toOptions(m: Map<string, number>) {
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([value, count]) => ({ value, label: value, count }));
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function JobsExplorer({ jobs, canManage, initialParams }: Props) {
  const [search, setSearch] = useState(initialParams.q ?? "");
  const [lifecycle, setLifecycle] = useState<JobLifecycle[]>(parseLegacyStatusParam(initialParams.status));
  const [cities, setCities] = useState<string[]>(parseList(initialParams.cidade));
  const [departments, setDepartments] = useState<string[]>(parseList(initialParams.area));
  const [openingReasons, setOpeningReasons] = useState<JobRequestReason[]>(
    parseList(initialParams.motivo).filter((r): r is JobRequestReason =>
      (JOB_REQUEST_REASON_ORDER as string[]).includes(r)
    )
  );
  const [candidates, setCandidates] = useState<CandidatesFilter>(
    initialParams.candidatos === "com" || initialParams.candidatos === "sem" ? initialParams.candidatos : ""
  );
  const [period, setPeriod] = useState<PeriodFilter>(
    (["7", "30", "90"] as const).find((p) => p === initialParams.periodo) ?? ""
  );
  const [quick, setQuick] = useState<Quick>(
    initialParams.pendencia === "atencao" || initialParams.pendencia === "triagem"
      ? initialParams.pendencia
      : "todas"
  );
  const [sort, setSort] = useState(
    SORT_OPTIONS.some((o) => o.value === initialParams.ordem) ? initialParams.ordem! : "date_desc"
  );

  const query = useDebouncedValue(search, 300);

  useSyncQueryString({
    q: query || undefined,
    status: lifecycle.join(","),
    cidade: cities.join(","),
    area: departments.join(","),
    motivo: openingReasons.join(","),
    candidatos: candidates,
    periodo: period,
    pendencia: quick === "atencao" || quick === "triagem" ? quick : undefined,
    ordem: sort !== "date_desc" ? sort : undefined,
  });

  const enriched: Enriched[] = useMemo(() => {
    const now = new Date();
    return jobs.map((j) => ({ ...j, reasons: jobAttentionReasons(j, now) }));
  }, [jobs]);

  const facets = useMemo(
    () => ({
      cities: toOptions(countBy(jobs.map((j) => j.city))),
      departments: toOptions(countBy(jobs.map((j) => j.department))),
      openingReasons: countBy(jobs.map((j) => j.openingReason)),
    }),
    [jobs]
  );

  const hasStatusFilter = lifecycle.length > 0;

  // Filtros "estruturais" (tudo menos o chip rápido) — base também das contagens dos chips.
  const baseFiltered = useMemo(() => {
    const q = normalizeText(query);
    const periodMs = period ? Number(period) * 86_400_000 : 0;
    const now = Date.now();
    return enriched.filter((job) => {
      if (q && !normalizeText(`${job.title} ${job.city ?? ""} ${job.department ?? ""}`).includes(q))
        return false;
      const l = jobLifecycle(job.status);
      if (lifecycle.length > 0 && !lifecycle.includes(l)) return false;
      // Sem filtro de status, a lista esconde encerradas/canceladas.
      if (!hasStatusFilter && (l === "FILLED" || l === "CLOSED")) return false;
      if (cities.length > 0 && !cities.includes(job.city ?? "")) return false;
      if (departments.length > 0 && !departments.includes(job.department ?? "")) return false;
      if (openingReasons.length > 0 && (!job.openingReason || !openingReasons.includes(job.openingReason)))
        return false;
      if (candidates === "com" && job.candidateCount === 0) return false;
      if (candidates === "sem" && job.candidateCount > 0) return false;
      if (periodMs && now - new Date(job.openedAt).getTime() > periodMs) return false;
      return true;
    });
  }, [enriched, query, lifecycle, hasStatusFilter, cities, departments, openingReasons, candidates, period]);

  const quickCounts = useMemo(
    () => ({
      atencao: baseFiltered.filter((j) => j.reasons.length > 0).length,
      triagem: baseFiltered.filter((j) => j.newCount > 0).length,
    }),
    [baseFiltered]
  );

  const filtered = useMemo(() => {
    let result = baseFiltered;
    if (quick === "atencao") result = result.filter((j) => j.reasons.length > 0);
    else if (quick === "triagem") result = result.filter((j) => j.newCount > 0);
    return sortJobs(result, quick === "atencao" && sort === "date_desc" ? "attention" : sort);
  }, [baseFiltered, quick, sort]);

  function clearFilters() {
    setLifecycle([]);
    setCities([]);
    setDepartments([]);
    setOpeningReasons([]);
    setCandidates("");
    setPeriod("");
  }

  function clearAll() {
    clearFilters();
    setSearch("");
    setQuick("todas");
  }

  // Status não é filtro do menu: chega só pelas métricas do topo e pelo "Mostrar encerradas"
  // (?status=), e aparece como chip removível abaixo da barra.
  const sections: FilterSection[] = [
    {
      key: "area",
      title: "Área / departamento",
      options: facets.departments,
      selected: departments,
      onToggle: (v) => setDepartments((p) => toggle(p, v)),
    },
    {
      key: "motivo",
      title: "Motivo da abertura",
      options: JOB_REQUEST_REASON_ORDER.map((r) => ({
        value: r,
        label: JOB_REQUEST_REASON_LABELS[r],
        count: facets.openingReasons.get(r) ?? 0,
      })),
      selected: openingReasons,
      onToggle: (v) => setOpeningReasons((p) => toggle(p, v as JobRequestReason)),
    },
    {
      key: "cidade",
      title: "Cidade",
      options: facets.cities,
      selected: cities,
      onToggle: (v) => setCities((p) => toggle(p, v)),
    },
    {
      key: "candidatos",
      title: "Candidatos",
      mode: "single",
      options: (["com", "sem"] as const).map((v) => ({ value: v, label: CANDIDATES_LABEL[v] })),
      selected: candidates ? [candidates] : [],
      onToggle: (v) => setCandidates((p) => (p === v ? "" : (v as CandidatesFilter))),
    },
    {
      key: "periodo",
      title: "Período de abertura",
      mode: "single",
      options: (["7", "30", "90"] as const).map((v) => ({ value: v, label: `Últimos ${v} dias` })),
      selected: period ? [period] : [],
      onToggle: (v) => setPeriod((p) => (p === v ? "" : (v as PeriodFilter))),
    },
  ];

  const chips: ActiveChip[] = [
    ...lifecycle.map((l) => ({
      key: `s-${l}`,
      label: `Status: ${JOB_LIFECYCLE_META[l].label}`,
      onRemove: () => setLifecycle((p) => p.filter((x) => x !== l)),
    })),
    ...departments.map((d) => ({
      key: `a-${d}`,
      label: `Área: ${d}`,
      onRemove: () => setDepartments((p) => p.filter((x) => x !== d)),
    })),
    ...openingReasons.map((r) => ({
      key: `m-${r}`,
      label: `Motivo: ${JOB_REQUEST_REASON_LABELS[r]}`,
      onRemove: () => setOpeningReasons((p) => p.filter((x) => x !== r)),
    })),
    ...cities.map((c) => ({
      key: `c-${c}`,
      label: `Cidade: ${c}`,
      onRemove: () => setCities((p) => p.filter((x) => x !== c)),
    })),
    ...(candidates ? [{ key: "cand", label: CANDIDATES_LABEL[candidates], onRemove: () => setCandidates("") }] : []),
    ...(period ? [{ key: "per", label: PERIOD_LABEL[period], onRemove: () => setPeriod("") }] : []),
  ];

  const hiddenTerminal = !hasStatusFilter
    ? jobs.filter((j) => ["FILLED", "CLOSED"].includes(jobLifecycle(j.status))).length
    : 0;

  return (
    <div className="max-w-5xl">
      {/* Toolbar */}
      {/* No celular a barra não fixa: com a busca, os filtros e os chips ela cobriria metade da tela. */}
      <div className="relative z-30 -mx-1 mb-3 space-y-2 border-b border-wg-border-lighter bg-slate-50 px-1 pb-2.5 pt-2 sm:sticky sm:top-11 md:top-0">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Pesquisar por vaga, cidade, área ou responsável"
            className="min-w-[220px] flex-1 basis-full sm:basis-0"
          />
          <FilterPopover sections={sections} activeCount={chips.length - lifecycle.length} onClear={clearFilters} />
          <SortDropdown
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            className="min-w-0 flex-1 sm:flex-none"
            selectClassName="w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <QuickFilterChips<Quick>
            label="Filtro rápido"
            value={quick}
            onChange={setQuick}
            options={[
              { value: "todas", label: "Todas" },
              { value: "atencao", label: "Precisam de atenção", count: quickCounts.atencao },
              { value: "triagem", label: "Com candidatos para triar", count: quickCounts.triagem },
            ]}
          />
          <span className="ml-auto text-meta text-wg-ink-muted" aria-live="polite">
            {filtered.length} de {jobs.length} vagas
          </span>
        </div>

        <ActiveFilterChips chips={chips} onClear={clearFilters} />
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="rounded-card border border-wg-border-lighter bg-white">
          {jobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Nenhuma vaga cadastrada"
              description="Vagas nascem de solicitações aprovadas ou podem ser criadas direto pelo RH."
              action={
                canManage ? (
                  <ButtonLink href="/vagas/nova" variant="primary" icon={Plus}>
                    Nova vaga
                  </ButtonLink>
                ) : undefined
              }
            />
          ) : quick === "atencao" && chips.length === 0 && !query ? (
            <EmptyState
              icon={Briefcase}
              title="Nenhuma vaga precisa de atenção no momento"
              description="Todas as vagas abertas têm movimentação recente e nenhum candidato parado na triagem."
            />
          ) : quick === "triagem" && chips.length === 0 && !query ? (
            <EmptyState
              icon={Users}
              title="Todas as candidaturas recentes já foram triadas"
              description="Nenhuma vaga tem candidatos na etapa Novo."
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="Não encontramos vagas com esses filtros"
              description="Revise a pesquisa ou remova algum filtro para ver mais resultados."
              action={
                <Button variant="secondary" onClick={clearAll}>
                  Limpar pesquisa e filtros
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {filtered.map((job) => (
              <JobListItem key={job.id} job={job} canManage={canManage} />
            ))}
          </ul>
          {hiddenTerminal > 0 && (
            <p className="mt-3 text-meta text-wg-ink-muted">
              {hiddenTerminal} {hiddenTerminal === 1 ? "vaga encerrada ou cancelada oculta" : "vagas encerradas ou canceladas ocultas"}.{" "}
              <button
                type="button"
                onClick={() => setLifecycle(["FILLED", "CLOSED"])}
                className="font-semibold text-wg-green-dark underline-offset-2 hover:underline"
              >
                Mostrar encerradas
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
