"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, SearchX, CalendarDays, Clock3, UserRound, FileWarning, Plus, Pencil } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ViewToggle } from "@/components/internal/ViewToggle";
import { SearchBar } from "@/components/internal/SearchBar";
import { SortDropdown } from "@/components/internal/SortDropdown";
import { StatusBadge, StageBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  FilterPopover,
  ActiveFilterChips,
  QuickFilterChips,
  type ActiveChip,
  type FilterSection,
} from "@/components/ui/FilterPopover";
import { useSyncQueryString, parseList } from "@/hooks/useSyncQueryString";
import {
  admissionFlags,
  daysUntilStart,
  DIGITAL_FORM_META,
  type AdmissionOverviewRow,
} from "@/lib/admissao/overview";
import { formatRelativeTime, normalizeText, cn } from "@/lib/utils";

export type AdmissionRow = AdmissionOverviewRow;

interface Option {
  id: string;
  name: string;
}

export type AdmissionQuick = "todas" | "atrasadas" | "proximas" | "documentos" | "formulario";

interface Props {
  rows: AdmissionRow[];
  stages: Option[];
  companies: Option[];
  positions: Option[];
  view?: "list" | "kanban";
  onViewChange?: (v: "list" | "kanban") => void;
  initialParams?: Record<string, string | undefined>;
  canManage?: boolean;
}

const SORT_OPTIONS = [
  { value: "startAsc", label: "Início mais próximo" },
  { value: "startDesc", label: "Início mais distante" },
  { value: "updated", label: "Movimentação recente" },
  { value: "progress", label: "Menor progresso" },
  { value: "recent", label: "Cadastro mais recente" },
  { value: "nameAZ", label: "Nome (A-Z)" },
];

const QUICK_KEYS: AdmissionQuick[] = ["todas", "atrasadas", "proximas", "documentos", "formulario"];

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function startLabel(days: number): { text: string; tone: "danger" | "warning" | "info" | "neutral" } {
  if (days < 0) return { text: `Atrasada ${-days} ${-days === 1 ? "dia" : "dias"}`, tone: "danger" };
  if (days === 0) return { text: "Começa hoje", tone: "warning" };
  if (days === 1) return { text: "Começa amanhã", tone: "warning" };
  if (days <= 7) return { text: `Em ${days} dias`, tone: "info" };
  return { text: `Em ${days} dias`, tone: "neutral" };
}

function progressPct(r: AdmissionRow) {
  if (!r.stageIndex || r.stageTotal === 0) return 0;
  return Math.round((r.stageIndex / r.stageTotal) * 100);
}

function fmtDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function AdmissionsExplorer({
  rows,
  stages,
  companies,
  view = "list",
  onViewChange,
  initialParams = {},
  canManage = false,
}: Props) {
  const [query, setQuery] = useState(initialParams.q ?? "");
  const [stageFilter, setStageFilter] = useState<string[]>(parseList(initialParams.etapa));
  const [companyFilter, setCompanyFilter] = useState<string[]>(parseList(initialParams.empresa));
  const [responsibleFilter, setResponsibleFilter] = useState<string[]>(parseList(initialParams.resp));
  const [quick, setQuick] = useState<AdmissionQuick>(
    QUICK_KEYS.includes(initialParams.filtro as AdmissionQuick) ? (initialParams.filtro as AdmissionQuick) : "todas"
  );
  const [sortKey, setSortKey] = useState(
    SORT_OPTIONS.some((o) => o.value === initialParams.ordem) ? initialParams.ordem! : "startAsc"
  );

  useSyncQueryString({
    q: query || undefined,
    etapa: stageFilter.join(","),
    empresa: companyFilter.join(","),
    resp: responsibleFilter.join(","),
    filtro: quick !== "todas" ? quick : undefined,
    ordem: sortKey !== "startAsc" ? sortKey : undefined,
    view: view === "kanban" ? "kanban" : undefined,
  });

  const today = useMemo(() => new Date(), []);
  const withFlags = useMemo(() => rows.map((r) => ({ r, f: admissionFlags(r, today) })), [rows, today]);

  const responsibles = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.responsibleName) m.set(r.responsibleName, (m.get(r.responsibleName) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [rows]);

  const base = useMemo(() => {
    const q = normalizeText(query);
    return withFlags.filter(({ r }) => {
      if (q && !normalizeText(`${r.fullName} ${r.cpf ?? ""} ${r.positionName ?? ""}`).includes(q)) return false;
      if (stageFilter.length > 0 && !stageFilter.includes(r.stageId ?? "")) return false;
      if (companyFilter.length > 0 && !companyFilter.includes(r.companyId ?? "")) return false;
      if (responsibleFilter.length > 0 && !responsibleFilter.includes(r.responsibleName ?? "")) return false;
      return true;
    });
  }, [withFlags, query, stageFilter, companyFilter, responsibleFilter]);

  const counts = useMemo(
    () => ({
      atrasadas: base.filter((x) => x.f.late).length,
      proximas: base.filter((x) => x.f.upcoming).length,
      documentos: base.filter((x) => x.f.missingDocs).length,
      formulario: base.filter((x) => x.f.waitingForm).length,
    }),
    [base]
  );

  const filtered = useMemo(() => {
    const list = base.filter(({ f }) => {
      if (quick === "atrasadas") return f.late;
      if (quick === "proximas") return f.upcoming;
      if (quick === "documentos") return f.missingDocs;
      if (quick === "formulario") return f.waitingForm;
      return true;
    });
    return list
      .map((x) => x.r)
      .sort((a, b) => {
        switch (sortKey) {
          case "startDesc":
            return (b.startDateISO ?? "").localeCompare(a.startDateISO ?? "");
          case "updated":
            return b.updatedAt.localeCompare(a.updatedAt);
          case "progress":
            return progressPct(a) - progressPct(b);
          case "recent":
            return b.createdAt.localeCompare(a.createdAt);
          case "nameAZ":
            return a.fullName.localeCompare(b.fullName, "pt-BR");
          default: {
            if (!a.startDateISO && !b.startDateISO) return 0;
            if (!a.startDateISO) return 1;
            if (!b.startDateISO) return -1;
            return a.startDateISO.localeCompare(b.startDateISO);
          }
        }
      });
  }, [base, quick, sortKey]);

  function clearFilters() {
    setStageFilter([]);
    setCompanyFilter([]);
    setResponsibleFilter([]);
  }

  const sections: FilterSection[] = [
    {
      key: "etapa",
      title: "Etapa",
      options: stages.map((s) => ({ value: s.id, label: s.name, count: rows.filter((r) => r.stageId === s.id).length })),
      selected: stageFilter,
      onToggle: (v) => setStageFilter((p) => toggle(p, v)),
    },
    {
      key: "empresa",
      title: "Empresa",
      options: companies.map((c) => ({ value: c.id, label: c.name, count: rows.filter((r) => r.companyId === c.id).length })),
      selected: companyFilter,
      onToggle: (v) => setCompanyFilter((p) => toggle(p, v)),
    },
    {
      key: "resp",
      title: "Responsável RH",
      options: responsibles.map(([name, count]) => ({ value: name, label: name, count })),
      selected: responsibleFilter,
      onToggle: (v) => setResponsibleFilter((p) => toggle(p, v)),
    },
  ];

  const chips: ActiveChip[] = [
    ...stageFilter.map((id) => ({
      key: `e-${id}`,
      label: `Etapa: ${stages.find((s) => s.id === id)?.name ?? "—"}`,
      onRemove: () => setStageFilter((p) => p.filter((x) => x !== id)),
    })),
    ...companyFilter.map((id) => ({
      key: `c-${id}`,
      label: `Empresa: ${companies.find((c) => c.id === id)?.name ?? "—"}`,
      onRemove: () => setCompanyFilter((p) => p.filter((x) => x !== id)),
    })),
    ...responsibleFilter.map((name) => ({
      key: `r-${name}`,
      label: `Responsável: ${name}`,
      onRemove: () => setResponsibleFilter((p) => p.filter((x) => x !== name)),
    })),
  ];

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-wg-border-lighter bg-white">
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhuma admissão em andamento"
          description="Cadastre uma admissão ou mova um candidato para a etapa Admissão no funil da vaga."
          action={
            canManage ? (
              <ButtonLink href="/admissoes/nova" variant="primary" icon={Plus}>
                Nova admissão
              </ButtonLink>
            ) : undefined
          }
        />
      </div>
    );
  }

  const quickEmpty: Record<AdmissionQuick, string> = {
    todas: "Não encontramos admissões com esses filtros",
    atrasadas: "Nenhuma admissão com início vencido",
    proximas: "Não há admissões previstas para os próximos 7 dias",
    documentos: "Nenhuma admissão com documentos obrigatórios pendentes",
    formulario: "Nenhum formulário admissional aguardando o candidato",
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Buscar por nome, CPF ou cargo"
            className="min-w-[220px] flex-1"
          />
          <FilterPopover sections={sections} activeCount={chips.length} onClear={clearFilters} />
          <SortDropdown value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
          {onViewChange && <ViewToggle view={view} onChange={onViewChange} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuickFilterChips<AdmissionQuick>
            label="Filtro rápido"
            value={quick}
            onChange={setQuick}
            options={[
              { value: "todas", label: "Todas", count: base.length },
              { value: "atrasadas", label: "Início vencido", count: counts.atrasadas },
              { value: "proximas", label: "Próximos 7 dias", count: counts.proximas },
              { value: "documentos", label: "Documentos pendentes", count: counts.documentos },
              { value: "formulario", label: "Aguardando formulário", count: counts.formulario },
            ]}
          />
          <span className="ml-auto text-meta text-wg-ink-muted" aria-live="polite">
            {filtered.length} de {rows.length} admissões em andamento
          </span>
        </div>
        <ActiveFilterChips chips={chips} onClear={clearFilters} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-wg-border-lighter bg-white">
          <EmptyState
            compact
            icon={SearchX}
            title={chips.length > 0 || query ? quickEmpty.todas : quickEmpty[quick]}
            action={
              chips.length > 0 || query || quick !== "todas" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    clearFilters();
                    setQuery("");
                    setQuick("todas");
                  }}
                >
                  Ver todas as admissões
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((r) => (
            <AdmissionListItem key={r.id} r={r} today={today} canManage={canManage} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdmissionListItem({ r, today, canManage }: { r: AdmissionRow; today: Date; canManage: boolean }) {
  const f = admissionFlags(r, today);
  const days = r.startDateISO ? daysUntilStart(r.startDateISO, today) : null;
  const start = days !== null ? startLabel(days) : null;
  const pct = progressPct(r);
  const pendingDocs = r.requiredDocsTotal - r.requiredDocsDone;
  const org = [r.positionName, r.companyName, r.branchName].filter(Boolean).join(" · ");
  const form = DIGITAL_FORM_META[r.digitalForm];

  return (
    <li className="group flex rounded-card border border-wg-border-lighter bg-white transition-shadow hover:shadow-[0_6px_18px_rgba(26,34,19,.07)] focus-within:shadow-[0_6px_18px_rgba(26,34,19,.07)]">
      <span
        aria-hidden
        className={cn("w-1 shrink-0 rounded-l-card", f.late ? "bg-danger" : f.missingDocs || f.waitingForm ? "bg-warning" : "bg-transparent")}
      />
      <div className="grid min-w-0 flex-1 gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-center">
        {/* Identificação */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admissoes/${r.id}`} className="truncate text-record-title text-wg-ink hover:text-wg-green-dark">
              {r.fullName}
            </Link>
            {r.stageName ? (
              <StageBadge color={r.stageColor ?? undefined} hint="Etapa atual da admissão">
                {r.stageName}
              </StageBadge>
            ) : (
              <StageBadge hint="Etapa atual da admissão">Sem etapa</StageBadge>
            )}
          </div>
          <p className="mt-0.5 truncate text-meta text-wg-ink-muted">{org || "Cargo não definido"}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta text-wg-ink-secondary">
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
              {r.responsibleName ?? <span className="text-wg-ink-muted">Sem responsável</span>}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
              {r.startDateISO ? `Início ${fmtDateBR(r.startDateISO)}` : "Início a definir"}
            </span>
            <span className="inline-flex items-center gap-1" suppressHydrationWarning>
              <Clock3 className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
              Atualizada {formatRelativeTime(r.updatedAt)}
            </span>
          </p>
        </div>

        {/* Progresso */}
        <div className="min-w-0">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-meta">
            <span className="text-wg-ink-secondary">
              {r.stageIndex ? `Etapa ${r.stageIndex} de ${r.stageTotal}` : "Jornada não iniciada"}
            </span>
            <span className="tabular-nums text-wg-ink-muted">{pct}%</span>
          </div>
          <ProgressBar value={pct} label={`Progresso da admissão de ${r.fullName}`} />
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-meta">
            {r.requiredDocsTotal > 0 &&
              (pendingDocs > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
                  <FileWarning className="h-3.5 w-3.5" aria-hidden />
                  {pendingDocs} {pendingDocs === 1 ? "documento pendente" : "documentos pendentes"}
                </span>
              ) : (
                <span className="text-success-fg">Documentos completos</span>
              ))}
          </p>
        </div>

        {/* Situação + ações */}
        <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
          {start && <StatusBadge tone={start.tone}>{start.text}</StatusBadge>}
          {r.digitalForm !== "SUBMITTED" && r.digitalForm !== "NOT_SENT" && (
            <StatusBadge tone={form.tone}>{form.label}</StatusBadge>
          )}
          {canManage && (
            <ButtonLink
              href={`/admissoes/${r.id}/editar`}
              variant="tertiary"
              size="sm"
              icon={Pencil}
              aria-label={`Editar admissão de ${r.fullName}`}
              className="md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              Editar
            </ButtonLink>
          )}
        </div>
      </div>
    </li>
  );
}
