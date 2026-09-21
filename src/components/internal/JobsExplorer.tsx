"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Briefcase, SearchX, Plus, Users, CalendarDays, Clock3, UserRound, Eye } from "lucide-react";
import {
  CONTRACT_TYPE_LABELS,
  MODALITY_LABELS,
  formatDate,
  formatRelativeTime,
  isKanbanDefaultHiddenStatus,
  normalizeText,
  pluralDays,
  daysSince,
  cn,
} from "@/lib/utils";
import {
  JOB_LIFECYCLE_META,
  JOB_LIFECYCLE_ORDER,
  JOB_STAGE_META,
  JOB_STAGE_ORDER,
  jobLifecycle,
  jobProcessStage,
  parseLegacyStatusParam,
  type JobLifecycle,
  type JobProcessStage,
} from "@/lib/recruitment/job-presentation";
import {
  jobAttentionReasons,
  operationalSituation,
  attentionScore,
  SITUATION_META,
  type AttentionReason,
} from "@/lib/recruitment/attention";
import { evaluateSla, SLA_META } from "@/lib/recruitment/sla";
import { JobActionsMenu } from "@/components/internal/JobActionsMenu";
import { ViewToggle } from "@/components/internal/ViewToggle";
import { SearchBar } from "@/components/internal/SearchBar";
import { SortDropdown } from "@/components/internal/SortDropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, StageBadge, TONE_DOT, TONE_TEXT } from "@/components/ui/StatusBadge";
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
import { Skeleton } from "@/components/ui/Skeleton";

const JobKanbanBoard = dynamic(
  () => import("@/components/internal/JobKanbanBoard").then((m) => m.JobKanbanBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex gap-4 overflow-hidden pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-card" />
        ))}
      </div>
    ),
  }
);

type View = "list" | "kanban";
type Quick = "todas" | "minhas" | "atencao" | "triagem";
type CandidatesFilter = "" | "com" | "sem";
type PeriodFilter = "" | "7" | "30" | "90";

interface Props {
  jobs: JobRow[];
  canManage: boolean;
  /** Query string da página — fonte do estado inicial dos filtros (persistência por URL). */
  initialParams: Record<string, string | undefined>;
  currentUserName?: string | null;
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

const KANBAN_STATUSES = ["DRAFT", "ACTIVE", "SCREENING", "INTERVIEW", "ADMISSION", "PAUSED", "CLOSED", "FILLED"];

const CANDIDATES_LABEL: Record<Exclude<CandidatesFilter, "">, string> = { com: "Com candidatos", sem: "Sem candidatos" };
const PERIOD_LABEL: Record<Exclude<PeriodFilter, "">, string> = {
  "7": "Abertas nos últimos 7 dias",
  "30": "Abertas nos últimos 30 dias",
  "90": "Abertas nos últimos 90 dias",
};

type Enriched = JobRow & { reasons: AttentionReason[] };

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

/** Idade da vaga conforme o status: "Aberta há X" só faz sentido para vagas abertas. */
function ageLabel(job: JobRow): string {
  const l = jobLifecycle(job.status);
  if (l === "OPEN") return `Aberta há ${pluralDays(daysSince(job.openedAt))}`;
  if (l === "DRAFT") return `Criada há ${pluralDays(daysSince(job.createdAt))}`;
  if (l === "PAUSED") return `Pausada em ${formatDate(job.statusChangedAt)}`;
  return `${JOB_LIFECYCLE_META[l].label} em ${formatDate(job.statusChangedAt)}`;
}

export function JobsExplorer({ jobs, canManage, initialParams, currentUserName }: Props) {
  const legacy = parseLegacyStatusParam(initialParams.status);
  const [view, setView] = useState<View>(initialParams.view === "kanban" ? "kanban" : "list");
  const [search, setSearch] = useState(initialParams.q ?? "");
  const [lifecycle, setLifecycle] = useState<JobLifecycle[]>(legacy.lifecycle);
  const [stages, setStages] = useState<JobProcessStage[]>([
    ...legacy.stage,
    ...(parseList(initialParams.etapa).filter((s) => (JOB_STAGE_ORDER as string[]).includes(s)) as JobProcessStage[]),
  ]);
  const [responsibles, setResponsibles] = useState<string[]>(parseList(initialParams.resp));
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
      : initialParams.minhas === "1"
        ? "minhas"
        : "todas"
  );
  const [sort, setSort] = useState(
    SORT_OPTIONS.some((o) => o.value === initialParams.ordem) ? initialParams.ordem! : "date_desc"
  );

  const query = useDebouncedValue(search, 300);

  useSyncQueryString({
    q: query || undefined,
    status: lifecycle.join(","),
    etapa: stages.join(","),
    resp: responsibles.join(","),
    cidade: cities.join(","),
    area: departments.join(","),
    motivo: openingReasons.join(","),
    candidatos: candidates,
    periodo: period,
    pendencia: quick === "atencao" || quick === "triagem" ? quick : undefined,
    minhas: quick === "minhas" ? "1" : undefined,
    ordem: sort !== "date_desc" ? sort : undefined,
    view: view === "kanban" ? "kanban" : undefined,
  });

  const enriched: Enriched[] = useMemo(() => {
    const now = new Date();
    return jobs.map((j) => ({ ...j, reasons: jobAttentionReasons(j, now) }));
  }, [jobs]);

  const facets = useMemo(
    () => ({
      responsibles: toOptions(countBy(jobs.map((j) => j.responsible))),
      cities: toOptions(countBy(jobs.map((j) => j.city))),
      departments: toOptions(countBy(jobs.map((j) => j.department))),
      openingReasons: countBy(jobs.map((j) => j.openingReason)),
      lifecycle: countBy(jobs.map((j) => jobLifecycle(j.status))),
      stage: countBy(jobs.map((j) => jobProcessStage(j.status))),
    }),
    [jobs]
  );

  const hasStatusFilter = lifecycle.length > 0 || stages.length > 0;

  // Filtros "estruturais" (tudo menos o chip rápido) — base também das contagens dos chips.
  const baseFiltered = useMemo(() => {
    const q = normalizeText(query);
    const periodMs = period ? Number(period) * 86_400_000 : 0;
    const now = Date.now();
    return enriched.filter((job) => {
      if (q && !normalizeText(`${job.title} ${job.city ?? ""} ${job.department ?? ""} ${job.responsible ?? ""}`).includes(q))
        return false;
      const l = jobLifecycle(job.status);
      if (lifecycle.length > 0 && !lifecycle.includes(l)) return false;
      if (stages.length > 0) {
        const s = jobProcessStage(job.status);
        if (!s || !stages.includes(s)) return false;
      }
      // Sem filtro de status: lista esconde encerradas/canceladas; Kanban esconde Pausada/Cancelada.
      if (!hasStatusFilter) {
        if (view === "list" && (l === "FILLED" || l === "CLOSED")) return false;
        if (view === "kanban" && isKanbanDefaultHiddenStatus(job.status)) return false;
      }
      if (responsibles.length > 0 && !responsibles.includes(job.responsible ?? "")) return false;
      if (cities.length > 0 && !cities.includes(job.city ?? "")) return false;
      if (departments.length > 0 && !departments.includes(job.department ?? "")) return false;
      if (openingReasons.length > 0 && (!job.openingReason || !openingReasons.includes(job.openingReason)))
        return false;
      if (candidates === "com" && job.candidateCount === 0) return false;
      if (candidates === "sem" && job.candidateCount > 0) return false;
      if (periodMs && now - new Date(job.openedAt).getTime() > periodMs) return false;
      return true;
    });
  }, [enriched, query, lifecycle, stages, hasStatusFilter, view, responsibles, cities, departments, openingReasons, candidates, period]);

  const quickCounts = useMemo(
    () => ({
      minhas: currentUserName ? baseFiltered.filter((j) => j.responsible === currentUserName).length : 0,
      atencao: baseFiltered.filter((j) => j.reasons.length > 0).length,
      triagem: baseFiltered.filter((j) => j.newCount > 0).length,
    }),
    [baseFiltered, currentUserName]
  );

  const filtered = useMemo(() => {
    let result = baseFiltered;
    if (quick === "minhas") result = result.filter((j) => currentUserName && j.responsible === currentUserName);
    else if (quick === "atencao") result = result.filter((j) => j.reasons.length > 0);
    else if (quick === "triagem") result = result.filter((j) => j.newCount > 0);
    return sortJobs(result, quick === "atencao" && sort === "date_desc" ? "attention" : sort);
  }, [baseFiltered, quick, sort, currentUserName]);

  const kanbanVisibleStatuses = useMemo(() => {
    if (!hasStatusFilter) return KANBAN_STATUSES.filter((s) => !isKanbanDefaultHiddenStatus(s));
    return KANBAN_STATUSES.filter((s) => {
      if (lifecycle.length > 0 && !lifecycle.includes(jobLifecycle(s))) return false;
      if (stages.length > 0) {
        const st = jobProcessStage(s);
        return !!st && stages.includes(st);
      }
      return true;
    });
  }, [hasStatusFilter, lifecycle, stages]);

  function clearFilters() {
    setLifecycle([]);
    setStages([]);
    setResponsibles([]);
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

  const sections: FilterSection[] = [
    {
      key: "status",
      title: "Status da vaga",
      options: JOB_LIFECYCLE_ORDER.map((l) => ({
        value: l,
        label: JOB_LIFECYCLE_META[l].label,
        count: facets.lifecycle.get(l) ?? 0,
      })),
      selected: lifecycle,
      onToggle: (v) => setLifecycle((p) => toggle(p, v as JobLifecycle)),
    },
    {
      key: "etapa",
      title: "Etapa do processo",
      options: JOB_STAGE_ORDER.map((s) => ({ value: s, label: JOB_STAGE_META[s].label, count: facets.stage.get(s) ?? 0 })),
      selected: stages,
      onToggle: (v) => setStages((p) => toggle(p, v as JobProcessStage)),
    },
    {
      key: "resp",
      title: "Responsável",
      options: facets.responsibles,
      selected: responsibles,
      onToggle: (v) => setResponsibles((p) => toggle(p, v)),
    },
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
    ...stages.map((s) => ({
      key: `e-${s}`,
      label: `Etapa: ${JOB_STAGE_META[s].label}`,
      onRemove: () => setStages((p) => p.filter((x) => x !== s)),
    })),
    ...responsibles.map((r) => ({
      key: `r-${r}`,
      label: `Responsável: ${r}`,
      onRemove: () => setResponsibles((p) => p.filter((x) => x !== r)),
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

  const hiddenTerminal =
    view === "list" && !hasStatusFilter
      ? jobs.filter((j) => ["FILLED", "CLOSED"].includes(jobLifecycle(j.status))).length
      : 0;

  return (
    <div className={view === "kanban" ? "" : "max-w-5xl"}>
      {/* Toolbar */}
      <div className="sticky top-11 z-30 -mx-1 mb-3 space-y-2.5 border-b border-wg-border-lighter bg-slate-50 px-1 pb-3 pt-2 md:top-0">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Pesquisar por vaga, cidade, área ou responsável"
            className="min-w-[220px] flex-1"
          />
          <FilterPopover sections={sections} activeCount={chips.length} onClear={clearFilters} />
          <SortDropdown value={sort} onChange={setSort} options={SORT_OPTIONS} />
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <QuickFilterChips<Quick>
            label="Filtro rápido"
            value={quick}
            onChange={setQuick}
            options={[
              { value: "todas", label: "Todas" },
              ...(currentUserName ? [{ value: "minhas" as const, label: "Minhas vagas", count: quickCounts.minhas }] : []),
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
            createdAt: j.createdAt,
            lastActivityAt: j.lastActivityAt,
            candidateCount: j.candidateCount,
          }))}
          visibleStatuses={kanbanVisibleStatuses}
          canManage={canManage}
        />
      ) : filtered.length === 0 ? (
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

function JobListItem({ job, canManage }: { job: Enriched; canManage: boolean }) {
  const lifecycle = jobLifecycle(job.status);
  const status = JOB_LIFECYCLE_META[lifecycle];
  const stage = jobProcessStage(job.status);
  const situation = operationalSituation(job.reasons);
  const sla = lifecycle === "OPEN" ? evaluateSla(daysSince(job.openedAt)) : null;

  const location = job.isTalentPool ? "Todas as praças" : [job.city, job.state].filter(Boolean).join("/");
  const facts = [
    location,
    job.department,
    job.openingReason ? JOB_REQUEST_REASON_LABELS[job.openingReason] : null,
    CONTRACT_TYPE_LABELS[job.contractType] ?? null,
    MODALITY_LABELS[job.modality] ?? null,
  ].filter(Boolean);

  return (
    <li
      className={cn(
        "group relative flex rounded-card border border-wg-border-lighter bg-white transition-shadow hover:shadow-[0_6px_18px_rgba(26,34,19,.07)]",
        "focus-within:shadow-[0_6px_18px_rgba(26,34,19,.07)]"
      )}
    >
      {/* Faixa = situação operacional (Normal / Atenção / Atrasada). O texto dos motivos abaixo
          explica a cor — ela nunca comunica sozinha. */}
      <span
        aria-hidden
        className={cn(
          "w-1 shrink-0 rounded-l-card",
          situation === "NORMAL" ? "bg-transparent" : TONE_DOT[SITUATION_META[situation].tone]
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/vagas/${job.id}/candidatos`}
              className="truncate text-record-title text-wg-ink hover:text-wg-green-dark"
            >
              {job.title}
            </Link>
            <StatusBadge tone={status.tone} hint={status.hint}>
              {status.label}
            </StatusBadge>
            {stage && (
              <StageBadge color={JOB_STAGE_META[stage].color} hint="Etapa do processo seletivo">
                {JOB_STAGE_META[stage].label}
              </StageBadge>
            )}
            {sla && (
              <StatusBadge tone={SLA_META[sla.state].tone} hint="Prazo de preenchimento (SLA)">
                {SLA_META[sla.state].label}
              </StatusBadge>
            )}
          </div>

          {facts.length > 0 && <p className="mt-0.5 truncate text-meta text-wg-ink-muted">{facts.join(" · ")}</p>}

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta text-wg-ink-secondary">
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
              {job.responsible ?? <span className="text-wg-ink-muted">Sem responsável</span>}
            </span>
            <span className="inline-flex items-center gap-1" suppressHydrationWarning>
              <CalendarDays className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
              {ageLabel(job)}
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={`Última movimentação: ${formatDate(job.lastActivityAt)}`}
              suppressHydrationWarning
            >
              <Clock3 className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
              Atualizada {formatRelativeTime(job.lastActivityAt)}
            </span>
          </p>

          {job.reasons.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5" aria-label="Motivos de atenção">
              {job.reasons.map((r) => (
                <li key={r.key} className={cn("inline-flex items-center gap-1 text-meta font-medium", TONE_TEXT[r.tone])}>
                  <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[r.tone])} />
                  {r.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={`/vagas/${job.id}/candidatos`}
            className="min-w-[88px] rounded-control px-2 py-1 text-right hover:bg-wg-bg"
            aria-label={`${job.candidateCount} candidatos em ${job.title}${job.newCount ? `, ${job.newCount} novos` : ""}`}
          >
            <span className="flex items-center justify-end gap-1 font-sora text-lg font-semibold tabular-nums text-wg-ink">
              <Users className="h-4 w-4 text-wg-ink-muted" aria-hidden />
              {job.candidateCount}
            </span>
            <span className="block text-[11.5px] text-wg-ink-muted">
              {job.newCount > 0 ? (
                <span className="font-semibold text-warning-fg">
                  {job.newCount} {job.newCount === 1 ? "novo" : "novos"}
                </span>
              ) : job.candidateCount === 1 ? (
                "candidato"
              ) : (
                "candidatos"
              )}
            </span>
          </Link>
          <ButtonLink
            href={`/vagas/${job.id}/candidatos`}
            variant="secondary"
            size="sm"
            icon={Eye}
            className="hidden md:inline-flex"
          >
            Ver candidatos
          </ButtonLink>
          {canManage && <JobActionsMenu jobId={job.id} jobTitle={job.title} status={job.status} />}
        </div>
      </div>
    </li>
  );
}
