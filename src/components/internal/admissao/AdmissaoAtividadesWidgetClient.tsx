"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, ClipboardList, ExternalLink } from "lucide-react";
import { setBatchItemsDone } from "@/lib/admissao/actions";
import { AdmissaoPreviewDrawer } from "./AdmissaoPreviewDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WidgetAdmission = {
  id: string;
  fullName: string;
  startDate: string | null;
  positionName: string | null;
  companyName: string | null;
  branchName: string | null;
  checklistDone: number;
  checklistTotal: number;
};

export type WidgetItem = {
  id: string;
  name: string;
  dueDate: string;
  admissionId: string;
  groupName: string;
};

export type Activity = {
  item: WidgetItem;
  admission: WidgetAdmission;
};

export type WidgetData = {
  overdue: Activity[];
  today: Activity[];
  upcoming: Activity[];
  overdueCount: number;
  todayCount: number;
  todayDone: number;
  todayStr: string;
};

type FilterKey = "all" | "today" | "upcoming";

type UrgencyBucket = "overdue" | "today" | "upcoming";

type BucketData = {
  urgency: UrgencyBucket;
  sections: Array<{ sectionName: string; items: WidgetItem[] }>;
};

type MasterGroup = {
  admission: WidgetAdmission;
  buckets: BucketData[];
};

// ─── Visual config por urgência ───────────────────────────────────────────────

const URGENCY_CFG = {
  overdue:  { label: "Atrasadas",       color: "#C0392B", bgColor: "#FDECEA", dotColor: "#C0392B" },
  today:    { label: "Hoje",            color: "#A0721E", bgColor: "#FCF1DD", dotColor: "#D97706" },
  upcoming: { label: "Próximos 3 dias", color: "#3C56A8", bgColor: "#E9EDFA", dotColor: "#3B82F6" },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDaysToStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ptBRDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function daysFromToday(dateStr: string | null, todayStr: string): number | null {
  if (!dateStr) return null;
  const a = new Date(dateStr.slice(0, 10) + "T00:00:00Z").getTime();
  const b = new Date(todayStr + "T00:00:00Z").getTime();
  return Math.round((a - b) / 86400000);
}

// Agrupa todas as atividades em um único Card Mestre por colaborador.
// A ordem de inserção respeita overdue → today → upcoming para que as
// admissões mais urgentes apareçam primeiro.
function groupByAdmissionMaster(
  overdue: Activity[],
  today: Activity[],
  upcoming: Activity[]
): MasterGroup[] {
  const map = new Map<string, MasterGroup>();

  function addActivities(activities: Activity[], urgency: UrgencyBucket) {
    for (const act of activities) {
      const aid = act.admission.id;
      if (!map.has(aid)) map.set(aid, { admission: act.admission, buckets: [] });
      const group = map.get(aid)!;
      let bucket = group.buckets.find((b) => b.urgency === urgency);
      if (!bucket) {
        bucket = { urgency, sections: [] };
        group.buckets.push(bucket);
      }
      let sec = bucket.sections.find((s) => s.sectionName === act.item.groupName);
      if (!sec) {
        sec = { sectionName: act.item.groupName, items: [] };
        bucket.sections.push(sec);
      }
      sec.items.push(act.item);
    }
  }

  addActivities(overdue, "overdue");
  addActivities(today, "today");
  addActivities(upcoming, "upcoming");

  return Array.from(map.values());
}

function isWhatsApp(name: string): boolean {
  return /whatsapp/i.test(name);
}

function waLink(fullName: string): string {
  const msg = encodeURIComponent(
    `Olá ${fullName}! Sou do RH da WG Baterias e entro em contato referente à sua admissão. 😊`
  );
  return `https://wa.me/?text=${msg}`;
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div className="flex-1 h-2 bg-[#E8EDE2] rounded-full overflow-hidden min-w-[56px]">
        <div
          className="h-full bg-[#90CB46] rounded-full"
          style={{ width: `${pct}%`, transition: "width 0.3s ease-in-out" }}
        />
      </div>
      <span className="text-[12px] font-bold text-wg-ink-muted tabular-nums shrink-0">
        {pct}% · {done}/{total} tarefas
      </span>
    </div>
  );
}

// ─── StartDateBadge ───────────────────────────────────────────────────────────

function StartDateBadge({ startDate, todayStr }: { startDate: string | null; todayStr: string }) {
  const days = daysFromToday(startDate, todayStr);
  if (days === null) return null;
  const fmt = ptBRDate(startDate!.slice(0, 10));
  if (days > 0)
    return (
      <span className="text-[11px] text-[#4F6930] font-medium">
        Inicia em {days} dia{days !== 1 ? "s" : ""} ({fmt})
      </span>
    );
  if (days === 0)
    return <span className="text-[11px] text-[#A0721E] font-semibold">Inicia hoje</span>;
  return (
    <span className="text-[11px] text-wg-ink-muted">
      Iniciou há {Math.abs(days)} dia{Math.abs(days) !== 1 ? "s" : ""}
    </span>
  );
}

// ─── OverdueBadge ─────────────────────────────────────────────────────────────

function OverdueBadge({ dueDate, todayStr }: { dueDate: string; todayStr: string }) {
  const n = Math.abs(daysFromToday(dueDate, todayStr) ?? 0);
  return (
    <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full bg-[#FDECEA] text-[#C0392B] shrink-0">
      {n === 1 ? "Venceu ontem" : `${n} dias atraso`}
    </span>
  );
}

// ─── WhatsAppIcon ─────────────────────────────────────────────────────────────

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.124.553 4.122 1.524 5.864L.057 23.448l5.73-1.505A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.992 0-3.854-.58-5.41-1.577l-.388-.231-4.015 1.053 1.069-3.914-.253-.403A9.78 9.78 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z" />
    </svg>
  );
}

// ─── CheckIcon ────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      className="w-3.5 h-3.5 fill-none stroke-white stroke-2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="2,7 5.5,10.5 12,3" />
    </svg>
  );
}

// ─── ActivityRow ──────────────────────────────────────────────────────────────
// Linha clicável inteira via <label>; checkbox + texto + badges em linha.
// Estado "selecionado" mostra riscado + cinza; "concluindo" mostra animação.

function ActivityRow({
  item,
  todayStr,
  urgency,
  fullName,
  checked,
  completing,
  onToggle,
}: {
  item: WidgetItem;
  todayStr: string;
  urgency: UrgencyBucket;
  fullName: string;
  checked: boolean;
  completing: boolean;
  onToggle: (id: string) => void;
}) {
  const isDone = completing || checked;

  return (
    <label
      className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg hover:bg-[#F5F7F3] cursor-pointer transition-colors"
      style={{
        opacity: completing ? 0.45 : 1,
        transform: completing ? "translateX(6px)" : "none",
        transition: "opacity 0.3s ease, transform 0.3s ease",
      }}
    >
      {completing ? (
        <span className="w-3.5 h-3.5 shrink-0 rounded-sm bg-[#90CB46] flex items-center justify-center">
          <CheckIcon />
        </span>
      ) : (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(item.id)}
          aria-label={`Selecionar: ${item.name}`}
          className="w-3.5 h-3.5 shrink-0 cursor-pointer accent-[#90CB46]"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[13px] font-medium leading-snug"
            style={{
              color: isDone ? "#9CA3AF" : undefined,
              textDecoration: isDone ? "line-through" : "none",
              transition: "color 0.2s, text-decoration 0.2s",
            }}
          >
            {item.name}
          </span>

          {!isDone && urgency === "overdue" && (
            <OverdueBadge dueDate={item.dueDate} todayStr={todayStr} />
          )}
          {!isDone && urgency === "upcoming" && (
            <span className="text-[10.5px] text-wg-ink-muted shrink-0">
              {ptBRDate(item.dueDate)}
            </span>
          )}
          {completing && (
            <span className="text-[10.5px] text-[#90CB46] font-semibold shrink-0">
              ✓ Concluído
            </span>
          )}
        </div>
      </div>

      {!completing && isWhatsApp(item.name) && (
        <a
          href={waLink(fullName)}
          target="_blank"
          rel="noopener noreferrer"
          title={`Enviar WhatsApp para ${fullName}`}
          className="shrink-0 text-[#25D366] hover:text-[#128C7E] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <WhatsAppIcon />
        </a>
      )}
    </label>
  );
}

// ─── BucketSection ────────────────────────────────────────────────────────────
// Renderiza um bloco de urgência (Atrasadas / Hoje / Próximos 3 dias) com seus
// grupos de checklist. "Concluir todas" virou link de texto discreto abaixo.

function BucketSection({
  bucket,
  todayStr,
  fullName,
  selected,
  completing,
  isPending,
  onToggle,
  onBatch,
}: {
  bucket: BucketData;
  todayStr: string;
  fullName: string;
  selected: Set<string>;
  completing: Set<string>;
  isPending: boolean;
  onToggle: (id: string) => void;
  onBatch: (ids: string[]) => void;
}) {
  const cfg = URGENCY_CFG[bucket.urgency];
  const allIds = bucket.sections.flatMap((s) => s.items.map((i) => i.id));
  const selectedInBucket = allIds.filter((id) => selected.has(id));

  return (
    <div className="px-4 pt-3 pb-2">
      {/* Rótulo de urgência */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dotColor }} />
        <span
          className="text-[10.5px] font-bold uppercase tracking-wider"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: cfg.bgColor, color: cfg.color }}
        >
          {allIds.length}
        </span>
      </div>

      {/* Grupos de checklist */}
      {bucket.sections.map((sec) => (
        <div key={sec.sectionName} className="mb-1">
          <div className="px-3 mb-0.5">
            <span className="text-[10px] font-semibold text-wg-ink-muted uppercase tracking-wide">
              {sec.sectionName}
            </span>
          </div>
          <div className="flex flex-col">
            {sec.items.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                todayStr={todayStr}
                urgency={bucket.urgency}
                fullName={fullName}
                checked={selected.has(item.id)}
                completing={completing.has(item.id)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Ações em lote — "Concluir todas" como link discreto */}
      <div className="flex items-center gap-3 px-3 pt-1.5">
        {selectedInBucket.length > 0 && (
          <button
            onClick={() => onBatch(selectedInBucket)}
            disabled={isPending}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#EAF4DC] text-[#3E5A2A] hover:bg-[#D7ECC4] transition-colors disabled:opacity-50"
          >
            {isPending ? "…" : `Concluir selecionadas (${selectedInBucket.length})`}
          </button>
        )}
        <button
          onClick={() => onBatch(allIds)}
          disabled={isPending}
          className="text-[11px] text-wg-ink-muted hover:text-wg-ink underline-offset-2 hover:underline transition-colors disabled:opacity-50"
        >
          {isPending ? "Concluindo…" : "Concluir todas"}
        </button>
      </div>
    </div>
  );
}

// ─── MasterAdmissionCard ──────────────────────────────────────────────────────
// Card único por colaborador com todos os buckets de urgência agrupados dentro.
// Sem borda rígida — usa shadow sutil + fundo branco para elevação.

function MasterAdmissionCard({
  group,
  todayStr,
  onOpenDrawer,
}: {
  group: MasterGroup;
  todayStr: string;
  onOpenDrawer: (admissionId: string) => void;
}) {
  const { admission, buckets } = group;
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const companyInfo = [admission.companyName, admission.branchName].filter(Boolean).join(" · ");

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBatch(itemIds: string[]) {
    if (!itemIds.length) return;
    setCompleting((prev) => new Set([...prev, ...itemIds]));
    startTransition(async () => {
      await setBatchItemsDone(admission.id, itemIds);
      setSelected(new Set());
      setCompleting(new Set());
      router.refresh();
    });
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        boxShadow: "0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header do card */}
      <div className="px-4 py-4 flex items-start gap-3">
        <button
          onClick={() => setIsOpen((o) => !o)}
          aria-label={isOpen ? "Recolher tarefas" : "Expandir tarefas"}
          className="shrink-0 mt-0.5 p-0.5 text-wg-ink-muted hover:text-wg-ink transition-colors"
        >
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14.5px] font-bold text-wg-ink">{admission.fullName}</span>
            {admission.positionName && (
              <span className="text-[12px] text-wg-ink-muted">{admission.positionName}</span>
            )}
          </div>
          {(companyInfo || admission.startDate) && (
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {companyInfo && (
                <span className="text-[11.5px] text-wg-ink-muted">{companyInfo}</span>
              )}
              <StartDateBadge startDate={admission.startDate} todayStr={todayStr} />
            </div>
          )}
          {admission.checklistTotal > 0 && (
            <div className="mt-2">
              <ProgressBar done={admission.checklistDone} total={admission.checklistTotal} />
            </div>
          )}
        </div>

        {/* Botões ghost/outline com ícones */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onOpenDrawer(admission.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5EAE0] text-[11.5px] font-medium text-wg-ink-muted hover:border-[#C8D5B8] hover:text-wg-ink hover:bg-[#F9FBF6] transition-all"
          >
            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
            Checklist
          </button>
          <Link
            href={`/admissoes/${admission.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5EAE0] text-[11.5px] font-medium text-wg-ink-muted hover:border-[#C8D5B8] hover:text-wg-ink hover:bg-[#F9FBF6] transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            Ficha
          </Link>
        </div>
      </div>

      {/* Accordion com animação suave via grid-template-rows */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 220ms ease-in-out",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div className="border-t border-[#F0F4EC] divide-y divide-[#F0F4EC]">
            {buckets.map((bucket) => (
              <BucketSection
                key={bucket.urgency}
                bucket={bucket}
                todayStr={todayStr}
                fullName={admission.fullName}
                selected={selected}
                completing={completing}
                isPending={isPending}
                onToggle={toggleItem}
                onBatch={handleBatch}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FilterChips ──────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "today", label: "Hoje" },
  { key: "upcoming", label: "Início Próximo (< 5 dias)" },
];

function FilterChips({
  active,
  onChange,
}: {
  active: FilterKey;
  onChange: (k: FilterKey) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {FILTER_OPTIONS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-all ${
            active === f.key
              ? "bg-[#90CB46] text-[#2A3D1C] shadow-sm"
              : "bg-[#F0F3EC] text-[#6B7860] hover:bg-[#E5EAE0]"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AdmissaoAtividadesWidgetClient({ data }: { data: WidgetData }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [drawerAdmissionId, setDrawerAdmissionId] = useState<string | null>(null);

  const { overdue, today, upcoming, overdueCount, todayCount, todayDone, todayStr } = data;

  const { filteredOverdue, filteredToday, filteredUpcoming } = useMemo(() => {
    const cut5 = addDaysToStr(todayStr, 5);
    const byStartDate = (activities: Activity[]) =>
      activities.filter(
        (a) =>
          a.admission.startDate &&
          a.admission.startDate >= todayStr &&
          a.admission.startDate <= cut5
      );

    if (filter === "today")
      return {
        filteredOverdue: [] as Activity[],
        filteredToday: today,
        filteredUpcoming: [] as Activity[],
      };
    if (filter === "upcoming")
      return {
        filteredOverdue: byStartDate(overdue),
        filteredToday: byStartDate(today),
        filteredUpcoming: byStartDate(upcoming),
      };
    return { filteredOverdue: overdue, filteredToday: today, filteredUpcoming: upcoming };
  }, [filter, overdue, today, upcoming, todayStr]);

  const masterGroups = useMemo(
    () => groupByAdmissionMaster(filteredOverdue, filteredToday, filteredUpcoming),
    [filteredOverdue, filteredToday, filteredUpcoming]
  );

  const totalPending = overdueCount + todayCount + upcoming.length;
  const isEmpty = totalPending === 0 && todayDone === 0;

  const allActivities = [...overdue, ...today, ...upcoming];
  const drawerAdmission = drawerAdmissionId
    ? (allActivities.find((a) => a.admission.id === drawerAdmissionId)?.admission ?? null)
    : null;
  const drawerItems = drawerAdmissionId
    ? allActivities.filter((a) => a.admission.id === drawerAdmissionId).map((a) => a.item)
    : [];

  return (
    <>
      <div className="bg-white border border-wg-border-lighter rounded-2xl p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[15px]">📋</span>
            <span className="text-wg-ink text-base font-bold font-sora">
              Atividades de Admissão
            </span>
          </div>
          <Link href="/admissoes" className="text-wg-green-dark text-[13px] font-semibold">
            Ver todas →
          </Link>
        </div>

        {/* Indicator pills */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FDECEA]">
            <span className="w-2 h-2 rounded-full bg-[#C0392B] shrink-0" />
            <span className="text-[12.5px] font-semibold text-[#C0392B]">
              {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FCF1DD]">
            <span className="w-2 h-2 rounded-full bg-[#A0721E] shrink-0" />
            <span className="text-[12.5px] font-semibold text-[#A0721E]">
              {todayCount} hoje
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EAF4DC]">
            <span className="w-2 h-2 rounded-full bg-[#4F6930] shrink-0" />
            <span className="text-[12.5px] font-semibold text-[#4F6930]">
              {todayDone} concluída{todayDone !== 1 ? "s" : ""} hoje
            </span>
          </div>
        </div>

        {/* Filter chips */}
        <FilterChips active={filter} onChange={setFilter} />

        {/* Content */}
        {isEmpty ? (
          <p className="text-wg-ink-muted text-sm py-8 text-center">
            Nenhuma atividade pendente nos próximos 3 dias. 🎉
          </p>
        ) : masterGroups.length === 0 ? (
          <p className="text-wg-ink-muted text-sm py-6 text-center">
            Nenhum resultado para o filtro selecionado.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {masterGroups.map((group) => (
              <MasterAdmissionCard
                key={group.admission.id}
                group={group}
                todayStr={todayStr}
                onOpenDrawer={setDrawerAdmissionId}
              />
            ))}
          </div>
        )}
      </div>

      <AdmissaoPreviewDrawer
        admission={drawerAdmission}
        pendingItems={drawerItems}
        todayStr={todayStr}
        onClose={() => setDrawerAdmissionId(null)}
      />
    </>
  );
}
