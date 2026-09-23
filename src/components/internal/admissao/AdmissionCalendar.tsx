"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import {
  Briefcase,
  Cake,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FileClock,
  Hourglass,
  List,
  Pencil,
  Stethoscope,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FilterBar, FilterSelect } from "@/components/ui/FilterControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { SideDrawer, DetailList } from "@/components/ui/SideDrawer";
import { StageBadge, StatusBadge } from "@/components/ui/StatusBadge";
import {
  addDays,
  buildCalendarEvents,
  CALENDAR_KINDS,
  EMPTY_CALENDAR_FILTERS,
  filterCalendarEvents,
  kindLabel,
  monthGrid,
  parseYmd,
  summarizeEvents,
  weekStart,
  type CalendarAdmission,
  type CalendarEvent,
  type CalendarFilters,
  type CalendarKind,
} from "@/lib/admissao/calendar";

export type { CalendarAdmission };

type View = "mes" | "semana" | "lista";

/** Estilo por tipo: tons suaves, ícone sempre junto (a cor nunca comunica sozinha). */
const KIND_STYLE: Record<CalendarKind, { icon: ElementType; chip: string; dot: string }> = {
  start: { icon: Briefcase, chip: "bg-info-bg text-info-fg hover:bg-[#DDE3F7]", dot: "bg-info" },
  exam: { icon: Stethoscope, chip: "bg-[#E4F1EC] text-[#2C6250] hover:bg-[#D6EAE2]", dot: "bg-[#3F8069]" },
  deadline: { icon: FileClock, chip: "bg-warning-bg text-warning-fg hover:bg-[#F8E6C3]", dot: "bg-warning" },
  experience: { icon: Hourglass, chip: "bg-neutral-bg text-neutral-fg hover:bg-[#E6EAE1]", dot: "bg-neutral" },
  birthday: { icon: Cake, chip: "bg-[#F1ECF8] text-[#5B4786] hover:bg-[#E7DFF3]", dot: "bg-[#7A64A8]" },
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_IN_CELL = 3;

function fmtLong(date: string) {
  return parseYmd(date).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtShortBR(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function eventTooltip(e: CalendarEvent) {
  const a = e.admission;
  return [a.fullName, kindLabel(e.kind), [a.positionName, a.branchName].filter(Boolean).join(" · "), e.note]
    .filter(Boolean)
    .join("\n");
}

interface Option {
  id: string;
  name: string;
}

interface Props {
  admissions: CalendarAdmission[];
  companies: Option[];
  branches: Option[];
  users: Option[];
  canManage: boolean;
  /** Hoje no fuso de São Paulo ("AAAA-MM-DD"), calculado no servidor. */
  today: string;
  initialParams: Record<string, string | undefined>;
}

export function AdmissionCalendar({ admissions, companies, branches, users, canManage, today, initialParams }: Props) {
  const [view, setView] = useState<View>(
    initialParams.visao === "semana" || initialParams.visao === "lista" ? initialParams.visao : "mes"
  );
  // Cursor = qualquer dia do período visível.
  const [cursor, setCursor] = useState<string>(() => {
    const p = initialParams.data;
    return p && /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : today;
  });
  const [filters, setFilters] = useState<CalendarFilters>({
    company: initialParams.empresa ?? "",
    branch: initialParams.filial ?? "",
    kind: initialParams.tipo ?? "",
    responsible: initialParams.resp ?? "",
  });
  const [selected, setSelected] = useState<{ type: "event"; ev: CalendarEvent } | { type: "day"; date: string } | null>(null);

  const cur = parseYmd(cursor);
  const year = cur.getFullYear();
  const month = cur.getMonth();

  // Estado na URL (sem navegação — os dados já estão no cliente).
  useEffect(() => {
    const p = new URLSearchParams();
    if (view !== "mes") p.set("visao", view);
    if (cursor !== today) p.set("data", cursor);
    if (filters.company) p.set("empresa", filters.company);
    if (filters.branch) p.set("filial", filters.branch);
    if (filters.kind) p.set("tipo", filters.kind);
    if (filters.responsible) p.set("resp", filters.responsible);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [view, cursor, filters, today]);

  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const range = useMemo(() => {
    if (view === "semana") {
      const from = weekStart(cursor);
      return { from, to: addDays(from, 6) };
    }
    if (view === "lista") {
      const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const last = addDays(`${month === 11 ? year + 1 : year}-${String(((month + 1) % 12) + 1).padStart(2, "0")}-01`, -1);
      return { from: first, to: last };
    }
    return { from: grid[0][0], to: grid[grid.length - 1][6] };
  }, [view, cursor, year, month, grid]);

  const events = useMemo(
    () => filterCalendarEvents(buildCalendarEvents(admissions, range, today), filters),
    [admissions, range, today, filters]
  );
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [events]);

  // Resumo de hoje (respeita os filtros) + próximo evento quando hoje está vazio.
  const todayInfo = useMemo(() => {
    const todays = filterCalendarEvents(buildCalendarEvents(admissions, { from: today, to: today }, today), filters);
    const next = todays.length
      ? null
      : (filterCalendarEvents(buildCalendarEvents(admissions, { from: addDays(today, 1), to: addDays(today, 60) }, today), filters)[0] ?? null);
    return { todays, next };
  }, [admissions, today, filters]);

  const activeCount = Object.values(filters).filter(Boolean).length;
  const setFilter = (k: keyof CalendarFilters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));

  function shift(dir: -1 | 1) {
    if (view === "semana") setCursor(addDays(cursor, dir * 7));
    else setCursor(`${month + dir < 0 ? year - 1 : month + dir > 11 ? year + 1 : year}-${String(((month + dir + 12) % 12) + 1).padStart(2, "0")}-01`);
  }

  const periodLabel =
    view === "semana"
      ? (() => {
          const a = parseYmd(range.from);
          const b = parseYmd(range.to);
          const sameMonth = a.getMonth() === b.getMonth();
          return `${a.getDate()}${sameMonth ? "" : ` de ${a.toLocaleDateString("pt-BR", { month: "short" })}`} – ${b.getDate()} de ${b.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
        })()
      : capitalize(cur.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));

  const kindOptions = CALENDAR_KINDS.filter((k) => k.enabled);
  const isCurrentPeriod = view === "semana" ? weekStart(today) === weekStart(cursor) : today.slice(0, 7) === cursor.slice(0, 7);

  return (
    <div className="flex flex-col gap-4">
      <TodaySummary today={today} events={todayInfo.todays} next={todayInfo.next} onOpen={(ev) => setSelected({ type: "event", ev })} />

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" onClick={() => shift(-1)} aria-label={view === "semana" ? "Semana anterior" : "Mês anterior"}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => shift(1)} aria-label={view === "semana" ? "Próxima semana" : "Próximo mês"}>
            <ChevronRight aria-hidden />
          </Button>
          <Button variant="secondary" onClick={() => setCursor(today)} disabled={isCurrentPeriod}>
            Hoje
          </Button>
        </div>
        <h2 className="ml-1 font-sora text-section-title text-wg-ink" aria-live="polite">
          {periodLabel}
        </h2>
        <SegmentedControl<View>
          className="ml-auto"
          label="Visualização do calendário"
          value={view}
          onChange={setView}
          options={[
            { value: "mes", label: "Mês", icon: CalendarDays },
            { value: "semana", label: "Semana", icon: CalendarRange },
            { value: "lista", label: "Lista", icon: List },
          ]}
        />
      </div>

      <FilterBar activeCount={activeCount} onClear={() => setFilters(EMPTY_CALENDAR_FILTERS)}>
        <FilterSelect
          label="Empresa"
          value={filters.company}
          onChange={setFilter("company")}
          options={[{ value: "", label: "Todas" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <FilterSelect
          label="Filial"
          value={filters.branch}
          onChange={setFilter("branch")}
          options={[{ value: "", label: "Todas" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
        />
        <FilterSelect
          label="Tipo"
          value={filters.kind}
          onChange={setFilter("kind")}
          options={[{ value: "", label: "Todos" }, ...kindOptions.map((k) => ({ value: k.value, label: k.label }))]}
        />
        <FilterSelect
          label="Responsável"
          value={filters.responsible}
          onChange={setFilter("responsible")}
          options={[
            { value: "", label: "Todos" },
            ...users.map((u) => ({ value: u.id, label: u.name })),
            { value: "none", label: "Sem responsável" },
          ]}
        />
      </FilterBar>

      <section className="overflow-hidden rounded-card border border-wg-border-lighter bg-white">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-wg-border-lighter px-4 py-2.5 text-[12px] text-wg-ink-muted">
          {kindOptions.map((k) => {
            const S = KIND_STYLE[k.value];
            return (
              <span key={k.value} className="inline-flex items-center gap-1.5">
                <S.icon className="h-3.5 w-3.5" aria-hidden />
                {k.label}
              </span>
            );
          })}
          <span className="ml-auto tabular-nums">
            {events.length} {events.length === 1 ? "evento" : "eventos"} no período
          </span>
        </div>

        {view === "mes" && (
          <MonthView
            grid={grid}
            month={month}
            today={today}
            byDay={byDay}
            onOpen={(ev) => setSelected({ type: "event", ev })}
            onOpenDay={(date) => setSelected({ type: "day", date })}
          />
        )}
        {view === "semana" && (
          <WeekView from={range.from} today={today} byDay={byDay} onOpen={(ev) => setSelected({ type: "event", ev })} />
        )}
        {view === "lista" && (
          <ListView
            events={events}
            today={today}
            onOpen={(ev) => setSelected({ type: "event", ev })}
            onClear={activeCount > 0 ? () => setFilters(EMPTY_CALENDAR_FILTERS) : undefined}
          />
        )}
      </section>

      <EventDrawer
        selected={selected}
        byDay={byDay}
        canManage={canManage}
        onSelect={(ev) => setSelected({ type: "event", ev })}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// ─── Peças ───────────────────────────────────────────────────────────────────

function EventChip({ ev, onOpen, wrap = false }: { ev: CalendarEvent; onOpen: (ev: CalendarEvent) => void; wrap?: boolean }) {
  const S = KIND_STYLE[ev.kind];
  return (
    <button
      type="button"
      onClick={() => onOpen(ev)}
      title={eventTooltip(ev)}
      aria-label={`${kindLabel(ev.kind)}: ${ev.admission.fullName}`}
      className={cn(
        "flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] font-medium leading-tight transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
        S.chip
      )}
    >
      <S.icon className="mt-px h-3 w-3 shrink-0" aria-hidden />
      <span className={wrap ? "line-clamp-2 break-words" : "truncate"}>{ev.admission.fullName}</span>
    </button>
  );
}

function TodaySummary({
  today,
  events,
  next,
  onOpen,
}: {
  today: string;
  events: CalendarEvent[];
  next: CalendarEvent | null;
  onOpen: (ev: CalendarEvent) => void;
}) {
  const label = capitalize(parseYmd(today).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-wg-border-lighter bg-white px-4 py-3">
      <p className="flex items-baseline gap-2 pr-4 sm:border-r sm:border-wg-border-lighter">
        <span className="font-sora text-base font-semibold text-wg-ink">Hoje</span>
        <span className="text-meta text-wg-ink-muted">{label}</span>
      </p>
      {events.length > 0 ? (
        <>
          <p className="text-body font-medium text-wg-ink">{summarizeEvents(events)}</p>
          <div className="flex flex-wrap gap-1.5">
            {events.slice(0, 4).map((e) => {
              const S = KIND_STYLE[e.kind];
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onOpen(e)}
                  title={eventTooltip(e)}
                  className={cn(
                    "inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
                    S.chip
                  )}
                >
                  <S.icon className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{e.admission.fullName}</span>
                </button>
              );
            })}
            {events.length > 4 && <span className="self-center text-meta text-wg-ink-muted">+{events.length - 4}</span>}
          </div>
        </>
      ) : (
        <p className="text-body text-wg-ink-muted">
          Nenhum evento hoje.
          {next && (
            <>
              {" "}
              Próximo:{" "}
              <button
                type="button"
                onClick={() => onOpen(next)}
                className="rounded-sm font-medium text-wg-ink underline decoration-wg-border-light underline-offset-2 hover:decoration-wg-green-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
              >
                {kindLabel(next.kind).toLowerCase()} de {next.admission.fullName.split(" ")[0]}
              </button>{" "}
              em {fmtShortBR(next.date).slice(0, 5)}.
            </>
          )}
        </p>
      )}
    </div>
  );
}

function MonthView({
  grid,
  month,
  today,
  byDay,
  onOpen,
  onOpenDay,
}: {
  grid: string[][];
  month: number;
  today: string;
  byDay: Map<string, CalendarEvent[]>;
  onOpen: (ev: CalendarEvent) => void;
  onOpenDay: (date: string) => void;
}) {
  return (
    <div className="relative overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-wg-border-lighter bg-wg-bg/60">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-[#8A9480]">
              {d}
            </div>
          ))}
        </div>
        {grid.map((week) => (
          <div key={week[0]} className="grid grid-cols-7">
            {week.map((date) => {
              const d = parseYmd(date);
              const inMonth = d.getMonth() === month;
              const evs = byDay.get(date) ?? [];
              const isToday = date === today;
              return (
                <div
                  key={date}
                  className={cn(
                    "min-h-[118px] border-b border-l border-wg-border-lighter p-1.5 first:border-l-0",
                    !inMonth && "bg-wg-bg/50",
                    isToday && "bg-[#F7FBF1]"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between px-0.5">
                    <span
                      className={cn(
                        "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] tabular-nums",
                        isToday ? "bg-wg-green-dark font-semibold text-white" : inMonth ? "font-medium text-wg-ink-secondary" : "text-wg-ink-muted/60"
                      )}
                      aria-label={isToday ? `Hoje, ${d.getDate()}` : undefined}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                  <div className={cn("space-y-1", !inMonth && "opacity-60")}>
                    {evs.slice(0, MAX_IN_CELL).map((e) => (
                      <EventChip key={e.id} ev={e} onOpen={onOpen} />
                    ))}
                    {evs.length > MAX_IN_CELL && (
                      <button
                        type="button"
                        onClick={() => onOpenDay(date)}
                        className="w-full rounded-md px-1.5 py-0.5 text-left text-[11.5px] font-semibold text-wg-green-dark hover:bg-wg-hover-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
                      >
                        +{evs.length - MAX_IN_CELL} mais
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekView({
  from,
  today,
  byDay,
  onOpen,
}: {
  from: string;
  today: string;
  byDay: Map<string, CalendarEvent[]>;
  onOpen: (ev: CalendarEvent) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="relative overflow-x-auto">
      <div className="grid min-w-[840px] grid-cols-7">
        {days.map((date, i) => {
          const d = parseYmd(date);
          const isToday = date === today;
          const evs = byDay.get(date) ?? [];
          return (
            <div key={date} className={cn("min-h-[360px] border-l border-wg-border-lighter first:border-l-0", isToday && "bg-[#F7FBF1]")}>
              <div className="flex items-center gap-2 border-b border-wg-border-lighter px-2.5 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#8A9480]">{WEEKDAYS[i]}</span>
                <span
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12.5px] tabular-nums",
                    isToday ? "bg-wg-green-dark font-semibold text-white" : "font-semibold text-wg-ink"
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="space-y-1.5 p-1.5">
                {evs.map((e) => (
                  <EventChip key={e.id} ev={e} onOpen={onOpen} wrap />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({
  events,
  today,
  onOpen,
  onClear,
}: {
  events: CalendarEvent[];
  today: string;
  onOpen: (ev: CalendarEvent) => void;
  onClear?: () => void;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nenhum evento encontrado neste período."
        description={onClear ? "Tente remover algum filtro." : "Datas de início, exames e prazos aparecem aqui assim que forem cadastrados."}
        action={
          onClear ? (
            <Button variant="secondary" size="sm" onClick={onClear}>
              Limpar filtros
            </Button>
          ) : undefined
        }
      />
    );
  }
  const groups: Array<{ date: string; items: CalendarEvent[] }> = [];
  for (const e of events) {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }
  return (
    <div className="divide-y divide-wg-border-lighter">
      {groups.map((g) => {
        const d = parseYmd(g.date);
        const head = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "").replace(/ de /g, " ");
        return (
          <section key={g.date} aria-label={fmtLong(g.date)}>
            <h3
              className={cn(
                "sticky top-0 z-[1] flex items-center gap-2 bg-wg-bg/90 px-4 py-2 text-[11.5px] font-bold uppercase tracking-wide backdrop-blur",
                g.date === today ? "text-wg-green-dark" : "text-[#8A9480]"
              )}
            >
              {g.date === today && <span className="h-1.5 w-1.5 rounded-full bg-wg-green-dark" aria-hidden />}
              {g.date === today ? `Hoje — ${head}` : head}
            </h3>
            <ul>
              {g.items.map((e) => {
                const S = KIND_STYLE[e.kind];
                const a = e.admission;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(e)}
                      className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAFCF6] focus-visible:bg-[#FAFCF6] focus-visible:outline-none sm:grid-cols-[180px_minmax(0,1fr)_auto]"
                    >
                      <span className="hidden items-center gap-2 text-meta font-medium text-wg-ink-secondary sm:flex">
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-control", S.chip)}>
                          <S.icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        {kindLabel(e.kind)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-record-title text-wg-ink">{a.fullName}</span>
                        <span className="block truncate text-meta text-wg-ink-muted">
                          <span className="sm:hidden">{kindLabel(e.kind)} · </span>
                          {[a.positionName, a.branchName ?? a.companyName].filter(Boolean).join(" · ") || "Cargo não definido"}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusBadge tone={e.status.tone}>{e.status.label}</StatusBadge>
                        <ChevronRight className="h-4 w-4 text-wg-ink-muted/60 group-hover:text-wg-ink-muted" aria-hidden />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EventDrawer({
  selected,
  byDay,
  canManage,
  onSelect,
  onClose,
}: {
  selected: { type: "event"; ev: CalendarEvent } | { type: "day"; date: string } | null;
  byDay: Map<string, CalendarEvent[]>;
  canManage: boolean;
  onSelect: (ev: CalendarEvent) => void;
  onClose: () => void;
}) {
  if (selected?.type === "day") {
    const evs = byDay.get(selected.date) ?? [];
    return (
      <SideDrawer open onClose={onClose} title={capitalize(fmtLong(selected.date))} subtitle={summarizeEvents(evs)}>
        <div className="space-y-1.5">
          {evs.map((e) => (
            <EventChip key={e.id} ev={e} onOpen={onSelect} wrap />
          ))}
        </div>
      </SideDrawer>
    );
  }

  const ev = selected?.type === "event" ? selected.ev : null;
  if (!ev) return null;
  const a = ev.admission;
  const S = KIND_STYLE[ev.kind];
  const where = [a.companyName, a.branchName].filter(Boolean).join(" · ");

  return (
    <SideDrawer
      open
      onClose={onClose}
      title={a.fullName}
      subtitle={[a.positionName, a.branchName].filter(Boolean).join(" · ") || undefined}
      leading={
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-control", S.chip)}>
          <S.icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      }
      footer={
        <>
          {canManage && ev.kind !== "birthday" && (
            <ButtonLink href={`/admissoes/${a.id}/editar`} variant="secondary" icon={Pencil}>
              {ev.kind === "exam" ? "Reagendar ASO" : ev.kind === "start" ? "Alterar data" : "Editar admissão"}
            </ButtonLink>
          )}
          <ButtonLink href={`/admissoes/${a.id}`} variant="primary" icon={ArrowUpRight}>
            Abrir admissão
          </ButtonLink>
        </>
      }
    >
      <DetailList
        items={[
          { label: "Tipo", value: kindLabel(ev.kind) },
          { label: "Data", value: capitalize(fmtLong(ev.date)) },
          { label: "Status", value: <StatusBadge tone={ev.status.tone}>{ev.status.label}</StatusBadge> },
          !!ev.note && { label: "Observação", value: ev.note },
          { label: "Cargo", value: a.positionName ?? "Não definido" },
          !!where && { label: "Empresa · filial", value: where },
          {
            label: "Etapa",
            value: a.stageName ? <StageBadge color={a.stageColor ?? undefined}>{a.stageName}</StageBadge> : "Sem etapa",
          },
          { label: "Responsável", value: a.responsibleName ?? "Não definido" },
        ]}
      />
      <p className="mt-4 text-[12px] leading-snug text-wg-ink-muted">
        O sistema registra apenas a data do evento (sem horário). Alterações de data são feitas no cadastro da admissão.
      </p>
    </SideDrawer>
  );
}
