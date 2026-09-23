"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ElementType } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  CircleSlash,
  FilePlus2,
  FileCheck2,
  FileX2,
  History,
  Loader2,
  MessageCircle,
  Pencil,
  RotateCcw,
  Send,
  Settings,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Undo2,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  Users,
  Workflow,
  XCircle,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FilterBar, FilterSelect, SearchField } from "@/components/ui/FilterControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { SideDrawer, DetailList } from "@/components/ui/SideDrawer";
import { TONE_SOFT } from "@/components/ui/StatusBadge";
import {
  ACTIVITY_CATEGORIES,
  activityDayKey,
  activityDayLabel,
  activityType,
  formatActivityTime,
  formatActivityTimestamp,
  type ActivityCategory,
  type ActivityIcon,
} from "@/lib/activity/catalog";
import {
  ACTIVITY_PERIODS,
  activityFiltersToQuery,
  EMPTY_ACTIVITY_FILTERS,
  type ActivityCursor,
  type ActivityFilters,
  type ActivityItem,
  type ActivityPeriod,
} from "@/lib/activity/feed";
import { loadMoreActivities } from "@/app/(internal)/admissoes/historico/actions";

const ICONS: Record<ActivityIcon, ElementType> = {
  created: FilePlus2,
  edit: Pencil,
  stage: Workflow,
  done: CheckCircle2,
  exam: Stethoscope,
  "form-sent": Send,
  form: ClipboardList,
  whatsapp: MessageCircle,
  "doc-ok": FileCheck2,
  "doc-bad": FileX2,
  undo: Undo2,
  send: Send,
  approve: CheckCircle2,
  reject: XCircle,
  return: RotateCcw,
  cancel: CircleSlash,
  reopen: RotateCcw,
  job: Briefcase,
  position: Briefcase,
  candidate: Users,
  "user-plus": UserPlus,
  user: UserCog,
  shield: ShieldCheck,
  "user-off": UserX,
  "user-on": UserCheck,
  trash: Trash2,
  settings: Settings,
  alert: AlertTriangle,
};

interface Option {
  id: string;
  name: string;
}

interface Props {
  initialItems: ActivityItem[];
  initialCursor: ActivityCursor | null;
  filters: ActivityFilters;
  users: Option[];
  companies: Option[];
  branches: Option[];
  loadError?: boolean;
}

export function ActivityFeed({ initialItems, initialCursor, filters, users, companies, branches, loadError }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [query, setQuery] = useState(filters.q);

  // Filtro novo na URL → o servidor manda outra primeira página; a lista recomeça dela
  // (sem remontar o componente, para a busca não perder o foco).
  useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
    setMoreError(null);
  }, [initialItems, initialCursor]);

  function apply(next: ActivityFilters) {
    const qs = activityFiltersToQuery(next);
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  const set = <K extends keyof ActivityFilters>(k: K) => (v: ActivityFilters[K]) => apply({ ...filters, [k]: v });

  // Busca com espera curta: só consulta o servidor quando a pessoa para de digitar.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  useEffect(() => {
    if (query.trim() === filtersRef.current.q.trim()) return;
    const t = setTimeout(() => apply({ ...filtersRef.current, q: query }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setMoreError(null);
    const params = Object.fromEntries(new URLSearchParams(activityFiltersToQuery(filters)));
    const res = await loadMoreActivities(params, cursor);
    setLoadingMore(false);
    if (!res.ok) {
      setMoreError(res.error);
      return;
    }
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.id));
      return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
    });
    setCursor(res.nextCursor);
  }

  const groups = useMemo(() => {
    const now = new Date();
    const out: Array<{ key: string; label: string; items: ActivityItem[] }> = [];
    for (const it of items) {
      const key = activityDayKey(it.at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(it);
      else out.push({ key, label: activityDayLabel(key, now), items: [it] });
    }
    return out;
  }, [items]);

  const activeCount =
    (filters.period !== "tudo" ? 1 : 0) + [filters.user, filters.category, filters.company, filters.branch].filter(Boolean).length + (filters.q.trim() ? 1 : 0);
  const scopedToAdmissions = !!(filters.company || filters.branch);

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        activeCount={activeCount}
        onClear={() => {
          setQuery("");
          apply(EMPTY_ACTIVITY_FILTERS);
        }}
        search={
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar colaborador, candidato ou usuário..."
            className="max-w-md"
          />
        }
        trailing={
          pending ? (
            <span role="status" className="inline-flex items-center gap-1.5 text-meta text-wg-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Atualizando…
            </span>
          ) : null
        }
      >
        <FilterSelect<ActivityPeriod>
          label="Período"
          value={filters.period}
          onChange={set("period")}
          options={ACTIVITY_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
        />
        <FilterSelect
          label="Usuário"
          value={filters.user}
          onChange={set("user")}
          options={[{ value: "", label: "Todos" }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
        />
        <FilterSelect<ActivityCategory | "">
          label="Tipo"
          value={filters.category}
          onChange={set("category")}
          options={[{ value: "", label: "Todos" }, ...ACTIVITY_CATEGORIES]}
        />
        <FilterSelect
          label="Empresa"
          value={filters.company}
          onChange={set("company")}
          options={[{ value: "", label: "Todas" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <FilterSelect
          label="Filial"
          value={filters.branch}
          onChange={set("branch")}
          options={[{ value: "", label: "Todas" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
        />
      </FilterBar>

      {scopedToAdmissions && (
        <p className="-mt-1 text-[12.5px] text-wg-ink-muted">
          Empresa e filial se aplicam às atividades de admissões e documentos.
        </p>
      )}

      <section
        aria-label="Atividades"
        aria-busy={pending}
        className={cn("rounded-card border border-wg-border-lighter bg-white transition-opacity", pending && "opacity-60")}
      >
        {loadError ? (
          <div role="alert" className="px-5 py-10 text-center">
            <p className="text-body text-wg-ink">Não foi possível carregar as atividades agora.</p>
            <Button className="mt-3" variant="secondary" size="sm" onClick={() => router.refresh()}>
              Tentar novamente
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nenhuma atividade encontrada."
            description={activeCount > 0 ? "Ajuste a busca ou os filtros para ver mais registros." : "As ações feitas no portal aparecem aqui."}
            action={
              activeCount > 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    apply(EMPTY_ACTIVITY_FILTERS);
                  }}
                >
                  Limpar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {groups.map((g) => (
              <div key={g.key}>
                <h2 className="sticky top-0 z-[1] border-b border-wg-border-lighter bg-wg-bg/90 px-5 py-2 text-[11.5px] font-bold uppercase tracking-wide text-[#8A9480] backdrop-blur first:rounded-t-card">
                  {g.label}
                </h2>
                <ol className="divide-y divide-wg-border-lighter">
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <ActivityRow item={it} onOpen={() => setSelected(it)} />
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            <div className="flex flex-col items-center gap-2 border-t border-wg-border-lighter px-5 py-4">
              {cursor ? (
                <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                  Carregar mais atividades
                </Button>
              ) : (
                <p className="text-meta text-wg-ink-muted">Fim do histórico para este filtro.</p>
              )}
              {moreError && (
                <p role="alert" className="text-meta text-danger-fg">
                  {moreError}
                </p>
              )}
            </div>
          </>
        )}
      </section>

      <ActivityDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ActivityRow({ item, onOpen }: { item: ActivityItem; onOpen: () => void }) {
  const t = activityType(item.type);
  const Icon = ICONS[t.icon];
  const label = item.title ?? t.label;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-5 py-3 text-left transition-colors hover:bg-[#FAFCF6] focus-visible:bg-[#FAFCF6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wg-green/40 lg:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:items-center"
    >
      <span className={cn("mt-0.5 flex h-8 w-8 items-center justify-center rounded-full lg:mt-0", TONE_SOFT[t.tone])} aria-hidden>
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0">
        <span className="block truncate text-record-title text-wg-ink">{item.subject.name}</span>
        {item.subject.detail && <span className="block truncate text-meta text-wg-ink-muted">{item.subject.detail}</span>}
        {/* No celular a ação fica sob o nome */}
        <span className="mt-1 block min-w-0 lg:hidden">
          <span className="block truncate text-meta font-medium text-wg-ink-secondary">{label}</span>
          <span className="block truncate text-[12px] text-wg-ink-muted">por {item.actor.name}</span>
        </span>
      </span>

      <span className="hidden min-w-0 lg:block">
        <span className="block truncate text-meta font-medium text-wg-ink-secondary">
          {label}
          {item.change && (
            <span className="font-normal text-wg-ink-muted">
              {" "}
              · {item.change.from} → {item.change.to}
            </span>
          )}
        </span>
        <span className="block truncate text-[12px] text-wg-ink-muted">por {item.actor.name}</span>
      </span>

      <time dateTime={item.at} className="whitespace-nowrap pt-0.5 text-[12px] tabular-nums text-wg-ink-muted lg:pt-0">
        {formatActivityTime(item.at)}
      </time>
    </button>
  );
}

function ActivityDrawer({ item, onClose }: { item: ActivityItem | null; onClose: () => void }) {
  if (!item) return null;
  const t = activityType(item.type);
  const Icon = ICONS[t.icon];
  const linkLabel = item.source.table.startsWith("admission")
    ? "Abrir admissão"
    : item.source.table === "job_request_history"
      ? "Abrir solicitação"
      : item.source.table === "application_stage_history"
        ? "Abrir candidatos da vaga"
        : item.source.table.startsWith("job")
          ? "Abrir histórico da vaga"
          : item.source.table === "config_change_log"
            ? "Abrir configurações"
            : "Abrir";

  return (
    <SideDrawer
      open
      size="md"
      onClose={onClose}
      title={item.title ?? t.label}
      subtitle={`${formatActivityTime(item.at)} · por ${item.actor.name}`}
      leading={
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", TONE_SOFT[t.tone])}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      }
      footer={
        item.subject.href ? (
          <ButtonLink href={item.subject.href} variant="primary" icon={ArrowUpRight}>
            {item.source.table === "admission_activity_log" && item.subject.href.startsWith("/usuarios") ? "Abrir usuário" : linkLabel}
          </ButtonLink>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="rounded-card border border-wg-border-lighter bg-wg-bg/50 px-4 py-3">
          <p className="text-record-title text-wg-ink">{item.subject.name}</p>
          {item.subject.detail && <p className="text-meta text-wg-ink-muted">{item.subject.detail}</p>}
        </div>

        {item.change && (
          <div>
            <h3 className="mb-2 font-inter text-label uppercase tracking-wide text-wg-ink-muted">Alteração</h3>
            <div className="flex flex-col items-stretch gap-1.5">
              <p className="rounded-control border border-wg-border-lighter bg-white px-3 py-2 text-body text-wg-ink-muted">
                <span className="sr-only">Estado anterior: </span>
                {item.change.from}
              </p>
              <ArrowDown className="mx-auto h-4 w-4 text-wg-ink-muted" aria-hidden />
              <p className="rounded-control border border-wg-green/50 bg-[#F7FBF1] px-3 py-2 text-body font-medium text-wg-ink">
                <span className="sr-only">Estado novo: </span>
                {item.change.to}
              </p>
            </div>
          </div>
        )}

        {item.changes.length > 0 && (
          <div>
            <h3 className="mb-2 font-inter text-label uppercase tracking-wide text-wg-ink-muted">Campos alterados</h3>
            <ul className="divide-y divide-wg-border-lighter rounded-card border border-wg-border-lighter">
              {item.changes.map((c, i) => (
                <li key={`${c.label}-${i}`} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-3 py-2 text-meta">
                  <span className="text-wg-ink-muted">{c.label}</span>
                  <span className="min-w-0 break-words text-wg-ink">
                    <span className="text-wg-ink-muted line-through decoration-wg-ink-muted/40">{c.from ?? "vazio"}</span>
                    {" → "}
                    <span className="font-medium">{c.to ?? "vazio"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(item.summary || item.details.length > 0) && (
          <div>
            <h3 className="mb-2 font-inter text-label uppercase tracking-wide text-wg-ink-muted">Descrição</h3>
            {item.summary && <p className="whitespace-pre-line text-body text-wg-ink">{item.summary}</p>}
            {item.details.map((d) => (
              <p key={d} className="text-body text-wg-ink-secondary">
                {d}
              </p>
            ))}
          </div>
        )}

        <div>
          <h3 className="mb-1 font-inter text-label uppercase tracking-wide text-wg-ink-muted">Dados técnicos</h3>
          <DetailList
            items={[
              { label: "Tipo", value: t.label },
              { label: "Data e hora", value: formatActivityTimestamp(item.at) },
              { label: "Realizado por", value: item.actor.name },
              { label: "Origem", value: <code className="text-[12px]">{item.source.table}</code> },
              !!item.source.code && { label: "Código", value: <code className="text-[12px]">{item.source.code}</code> },
              { label: "Registro", value: <code className="break-all text-[12px]">{item.source.id}</code> },
            ]}
          />
        </div>
      </div>
    </SideDrawer>
  );
}
