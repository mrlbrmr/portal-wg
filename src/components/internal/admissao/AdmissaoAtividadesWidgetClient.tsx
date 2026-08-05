"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { setBatchItemsDone } from "@/lib/admissao/actions";
import { AdmissaoPreviewDrawer } from "./AdmissaoPreviewDrawer";

// ─── Types (espelham o server; duplicados para evitar import de módulo server) ─

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

type AdmissionGroup = {
  admission: WidgetAdmission;
  sections: Array<{ sectionName: string; items: WidgetItem[] }>;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function groupByAdmission(activities: Activity[]): AdmissionGroup[] {
  const map = new Map<string, AdmissionGroup>();
  for (const act of activities) {
    const aid = act.admission.id;
    if (!map.has(aid)) map.set(aid, { admission: act.admission, sections: [] });
    const group = map.get(aid)!;
    let sec = group.sections.find((s) => s.sectionName === act.item.groupName);
    if (!sec) {
      sec = { sectionName: act.item.groupName, items: [] };
      group.sections.push(sec);
    }
    sec.items.push(act.item);
  }
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

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div className="flex-1 h-2.5 bg-[#E8EDE2] rounded-full overflow-hidden min-w-[56px]">
        <div
          className="h-full bg-[#90CB46] rounded-full transition-all"
          style={{ width: `${pct}%` }}
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

// ─── WhatsApp icon SVG ────────────────────────────────────────────────────────

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.124.553 4.122 1.524 5.864L.057 23.448l5.73-1.505A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.992 0-3.854-.58-5.41-1.577l-.388-.231-4.015 1.053 1.069-3.914-.253-.403A9.78 9.78 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z" />
    </svg>
  );
}

// ─── ActivityRowCheckbox ──────────────────────────────────────────────────────

function ActivityRowCheckbox({
  item,
  todayStr,
  urgency,
  fullName,
  checked,
  onToggle,
}: {
  item: WidgetItem;
  todayStr: string;
  urgency: "overdue" | "today" | "upcoming";
  fullName: string;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2 pl-2 pr-2 border-t border-[#F0F3EC]">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.id)}
        aria-label={`Selecionar: ${item.name}`}
        className="w-3.5 h-3.5 shrink-0 cursor-pointer accent-[#90CB46]"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] text-wg-ink font-medium leading-snug">{item.name}</span>
          {urgency === "overdue" && (
            <OverdueBadge dueDate={item.dueDate} todayStr={todayStr} />
          )}
          {/* Tag "Hoje" omitida: o cabeçalho de seção já indica urgência */}
          {urgency === "upcoming" && (
            <span className="text-[10.5px] text-wg-ink-muted shrink-0">
              {ptBRDate(item.dueDate)}
            </span>
          )}
        </div>
      </div>
      {isWhatsApp(item.name) && (
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
    </div>
  );
}

// ─── SectionBatch ─────────────────────────────────────────────────────────────

function SectionBatch({
  sectionName,
  items,
  selected,
  isPending,
  onToggleSection,
  onBatch,
}: {
  sectionName: string;
  items: WidgetItem[];
  selected: Set<string>;
  isPending: boolean;
  onToggleSection: (ids: string[]) => void;
  onBatch: (ids: string[]) => void;
}) {
  const sectionIds = items.map((i) => i.id);
  const selectedInSection = sectionIds.filter((id) => selected.has(id));
  const allSectionSelected =
    sectionIds.length > 0 && sectionIds.every((id) => selected.has(id));

  return (
    <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={allSectionSelected}
          onChange={() => onToggleSection(sectionIds)}
          aria-label={`Selecionar todos de ${sectionName}`}
          className="w-3.5 h-3.5 accent-[#90CB46] cursor-pointer shrink-0"
        />
        <span className="text-[10.5px] font-semibold text-wg-ink-muted uppercase tracking-wide">
          {sectionName}
        </span>
        <span className="text-[10px] text-wg-ink-muted">({items.length})</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {selectedInSection.length > 0 && (
          <button
            onClick={() => onBatch(selectedInSection)}
            disabled={isPending}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#EAF4DC] text-[#3E5A2A] hover:bg-[#D7ECC4] transition-colors disabled:opacity-50"
          >
            {isPending ? "…" : `Concluir selecionadas (${selectedInSection.length})`}
          </button>
        )}
        <button
          onClick={() => onBatch(sectionIds)}
          disabled={isPending}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#E5EAE0] text-wg-ink-muted hover:bg-[#F5F7F3] transition-colors disabled:opacity-50"
        >
          {isPending ? "…" : "Concluir todas"}
        </button>
      </div>
    </div>
  );
}

// ─── AdmissionAccordionCard ───────────────────────────────────────────────────

function AdmissionAccordionCard({
  group,
  todayStr,
  urgency,
  onOpenDrawer,
}: {
  group: AdmissionGroup;
  todayStr: string;
  urgency: "overdue" | "today" | "upcoming";
  onOpenDrawer: (admissionId: string) => void;
}) {
  const { admission, sections } = group;
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const companyInfo = [admission.companyName, admission.branchName]
    .filter(Boolean)
    .join(" · ");

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSection(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function handleBatch(itemIds: string[]) {
    if (!itemIds.length) return;
    startTransition(async () => {
      await setBatchItemsDone(admission.id, itemIds);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="bg-[#FAFBF8] border border-[#E8EDE2] rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <button
          onClick={() => setIsOpen((o) => !o)}
          aria-label={isOpen ? "Recolher tarefas" : "Expandir tarefas"}
          className="shrink-0 mt-1 p-0.5 text-wg-ink-muted hover:text-wg-ink transition-colors"
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

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onOpenDrawer(admission.id)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E5EAE0] text-[11.5px] font-medium text-wg-ink-muted hover:bg-[#F5F7F3] transition-colors"
          >
            📋 Checklist
          </button>
          <Link
            href={`/admissoes/${admission.id}`}
            className="px-2.5 py-1.5 rounded-lg border border-[#E5EAE0] text-[11.5px] font-medium text-wg-ink-muted hover:bg-[#F5F7F3] transition-colors"
          >
            Ficha ↗
          </Link>
        </div>
      </div>

      {/* Accordion body — grid-template-rows para animação suave */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease-in-out",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div className="border-t border-[#E8EDE2]">
            {sections.map((sec, idx) => (
              <div
                key={sec.sectionName}
                className={idx < sections.length - 1 ? "border-b border-[#E8EDE2]" : ""}
              >
                <SectionBatch
                  sectionName={sec.sectionName}
                  items={sec.items}
                  selected={selected}
                  isPending={isPending}
                  onToggleSection={toggleSection}
                  onBatch={handleBatch}
                />
                <div className="px-4 pb-2">
                  {sec.items.map((item) => (
                    <ActivityRowCheckbox
                      key={item.id}
                      item={item}
                      todayStr={todayStr}
                      urgency={urgency}
                      fullName={admission.fullName}
                      checked={selected.has(item.id)}
                      onToggle={toggleItem}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── UrgencySection ───────────────────────────────────────────────────────────

function UrgencySection({
  label,
  color,
  bgColor,
  dotColor,
  groups,
  todayStr,
  urgency,
  onOpenDrawer,
}: {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  groups: AdmissionGroup[];
  todayStr: string;
  urgency: "overdue" | "today" | "upcoming";
  onOpenDrawer: (admissionId: string) => void;
}) {
  if (groups.length === 0) return null;
  const count = groups.reduce(
    (acc, g) => acc + g.sections.flatMap((s) => s.items).length,
    0
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
        <span className="text-[13px] font-bold" style={{ color }}>
          {label}
        </span>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: bgColor, color }}
        >
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {groups.map((g) => (
          <AdmissionAccordionCard
            key={g.admission.id}
            group={g}
            todayStr={todayStr}
            urgency={urgency}
            onOpenDrawer={onOpenDrawer}
          />
        ))}
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
          className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ${
            active === f.key
              ? "bg-[#3E4A34] text-white"
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

  const overdueGroups = groupByAdmission(overdue);
  const todayGroups = groupByAdmission(today);
  const upcomingGroups = groupByAdmission(upcoming);

  const cut5 = addDaysToStr(todayStr, 5);
  const byStartDate = (groups: AdmissionGroup[]) =>
    groups.filter(
      (g) =>
        g.admission.startDate &&
        g.admission.startDate >= todayStr &&
        g.admission.startDate <= cut5
    );

  const filteredOverdue = filter === "upcoming" ? byStartDate(overdueGroups) : overdueGroups;
  const filteredToday = filter === "upcoming" ? byStartDate(todayGroups) : todayGroups;
  const filteredUpcoming =
    filter === "today"
      ? []
      : filter === "upcoming"
      ? byStartDate(upcomingGroups)
      : upcomingGroups;

  const totalPending = overdueCount + todayCount + upcoming.length;
  const isEmpty = totalPending === 0 && todayDone === 0;

  const allActivities = [...overdue, ...today, ...upcoming];
  const drawerAdmission = drawerAdmissionId
    ? (allActivities.find((a) => a.admission.id === drawerAdmissionId)?.admission ?? null)
    : null;
  const drawerItems = drawerAdmissionId
    ? allActivities
        .filter((a) => a.admission.id === drawerAdmissionId)
        .map((a) => a.item)
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
            <span className="text-[12.5px] font-semibold text-[#A0721E]">{todayCount} hoje</span>
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
        ) : (
          <div className="flex flex-col gap-5">
            <UrgencySection
              label="Atrasadas"
              color="#C0392B"
              bgColor="#FDECEA"
              dotColor="#C0392B"
              groups={filteredOverdue}
              todayStr={todayStr}
              urgency="overdue"
              onOpenDrawer={setDrawerAdmissionId}
            />
            <UrgencySection
              label="Hoje"
              color="#A0721E"
              bgColor="#FCF1DD"
              dotColor="#D97706"
              groups={filteredToday}
              todayStr={todayStr}
              urgency="today"
              onOpenDrawer={setDrawerAdmissionId}
            />
            <UrgencySection
              label="Próximos 3 dias"
              color="#3C56A8"
              bgColor="#E9EDFA"
              dotColor="#3B82F6"
              groups={filteredUpcoming}
              todayStr={todayStr}
              urgency="upcoming"
              onOpenDrawer={setDrawerAdmissionId}
            />
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
