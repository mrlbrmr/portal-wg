import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MarkDoneButton } from "./MarkDoneButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type WidgetAdmission = {
  id: string;
  fullName: string;
  startDate: string | null;
  positionName: string | null;
  companyName: string | null;
  branchName: string | null;
  checklistDone: number;
  checklistTotal: number;
};

type WidgetItem = {
  id: string;
  name: string;
  dueDate: string; // "YYYY-MM-DD"
  admissionId: string;
  groupName: string;
};

type Activity = {
  item: WidgetItem;
  admission: WidgetAdmission;
};

type AdmissionGroup = {
  admission: WidgetAdmission;
  sections: Array<{ sectionName: string; items: WidgetItem[] }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayUTCStr(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

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
    let sec = group.sections.find(s => s.sectionName === act.item.groupName);
    if (!sec) { sec = { sectionName: act.item.groupName, items: [] }; group.sections.push(sec); }
    sec.items.push(act.item);
  }
  return Array.from(map.values());
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function fetchWidgetData() {
  const supabase = await createClient();
  const todayStr = todayUTCStr();
  const in3Str = addDaysToStr(todayStr, 3);
  const todayStart = new Date(todayStr + "T00:00:00Z").toISOString();
  const tomorrowStart = new Date(addDaysToStr(todayStr, 1) + "T00:00:00Z").toISOString();

  const { data: admData } = await supabase
    .from("admissions")
    .select(`
      id, fullName, startDate,
      position:admission_positions(name),
      company:admission_companies(name),
      branch:admission_branches(name),
      stage:admission_stages(isFinal),
      checklistGroups:admission_checklist_groups(items:admission_checklist_items(id, status, parentId))
    `)
    .is("deletedAt", null);

  type RawAdm = {
    id: string; fullName: string; startDate: string | null;
    position: { name: string } | null; company: { name: string } | null;
    branch: { name: string } | null; stage: { isFinal: boolean } | null;
    checklistGroups: Array<{
      items: Array<{ id: string; status: string; parentId: string | null }>;
    }> | null;
  };

  const active = ((admData ?? []) as unknown as RawAdm[]).filter(a => !a.stage?.isFinal);
  const activeIds = active.map(a => a.id);

  if (activeIds.length === 0) {
    return { overdue: [], today: [], upcoming: [], overdueCount: 0, todayCount: 0, todayDone: 0, todayStr };
  }

  const admissionMap = new Map<string, WidgetAdmission>(
    active.map(a => {
      const topItems = (a.checklistGroups ?? []).flatMap(g => g.items ?? []).filter(i => !i.parentId);
      return [a.id, {
        id: a.id, fullName: a.fullName, startDate: a.startDate,
        positionName: a.position?.name ?? null,
        companyName: a.company?.name ?? null,
        branchName: a.branch?.name ?? null,
        checklistDone: topItems.filter(i => i.status === "DONE").length,
        checklistTotal: topItems.length,
      }];
    })
  );

  const [itemsRes, doneRes] = await Promise.all([
    supabase
      .from("admission_checklist_items")
      .select("id, name, dueDate, admissionId, group:admission_checklist_groups(name)")
      .eq("status", "PENDING")
      .not("dueDate", "is", null)
      .lte("dueDate", in3Str)
      .in("admissionId", activeIds)
      .order("dueDate", { ascending: true }),

    supabase
      .from("admission_checklist_items")
      .select("*", { count: "exact", head: true })
      .eq("status", "DONE")
      .gte("completedAt", todayStart)
      .lt("completedAt", tomorrowStart)
      .in("admissionId", activeIds),
  ]);

  type RawItem = {
    id: string; name: string; dueDate: string; admissionId: string;
    group: { name: string } | null;
  };

  const activities: Activity[] = ((itemsRes.data ?? []) as unknown as RawItem[]).flatMap(item => {
    const admission = admissionMap.get(item.admissionId);
    if (!admission) return [];
    return [{
      item: {
        id: item.id, name: item.name, dueDate: item.dueDate,
        admissionId: item.admissionId,
        groupName: item.group?.name ?? "Geral",
      },
      admission,
    }];
  });

  const overdue  = activities.filter(a => a.item.dueDate < todayStr);
  const today    = activities.filter(a => a.item.dueDate === todayStr);
  const upcoming = activities.filter(a => a.item.dueDate > todayStr);

  return {
    overdue, today, upcoming,
    overdueCount: overdue.length,
    todayCount: today.length,
    todayDone: doneRes.count ?? 0,
    todayStr,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-[#E8EDE2] rounded-full overflow-hidden min-w-[48px]">
        <div className="h-full bg-[#90CB46] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-wg-ink-muted tabular-nums shrink-0">{pct}%</span>
    </div>
  );
}

function StartDateBadge({ startDate, todayStr }: { startDate: string | null; todayStr: string }) {
  const days = daysFromToday(startDate, todayStr);
  if (days === null) return null;
  const dateFormatted = ptBRDate(startDate!.slice(0, 10));
  if (days > 0) return <span className="text-[11px] text-[#4F6930] font-medium">Inicia em {days} dia{days !== 1 ? "s" : ""} ({dateFormatted})</span>;
  if (days === 0) return <span className="text-[11px] text-[#A0721E] font-semibold">Inicia hoje</span>;
  return <span className="text-[11px] text-wg-ink-muted">Iniciou há {Math.abs(days)} dia{Math.abs(days) !== 1 ? "s" : ""}</span>;
}

function OverdueBadge({ dueDate, todayStr }: { dueDate: string; todayStr: string }) {
  const n = Math.abs(daysFromToday(dueDate, todayStr) ?? 0);
  return (
    <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-[#FDECEA] text-[#C0392B] shrink-0">
      {n === 1 ? "Venceu ontem" : `${n} dias atraso`}
    </span>
  );
}

function ActivityRow({
  item, todayStr, urgency,
}: { item: WidgetItem; todayStr: string; urgency: "overdue" | "today" | "upcoming" }) {
  return (
    <div className="flex items-center gap-2 py-2 pl-3 border-t border-[#F0F3EC]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] text-wg-ink font-medium leading-snug">{item.name}</span>
          {urgency === "overdue" && <OverdueBadge dueDate={item.dueDate} todayStr={todayStr} />}
          {urgency === "today" && (
            <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-[#FCF1DD] text-[#A0721E] shrink-0">Hoje</span>
          )}
          {urgency === "upcoming" && (
            <span className="text-[10.5px] text-wg-ink-muted shrink-0">{ptBRDate(item.dueDate)}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <MarkDoneButton admissionId={item.admissionId} itemId={item.id} />
        <Link
          href={`/admissoes/${item.admissionId}?tab=checklist`}
          className="px-2.5 py-1 rounded-lg border border-[#E5EAE0] text-[11.5px] text-wg-ink-muted hover:bg-[#F5F7F3] transition-colors"
        >
          Checklist
        </Link>
        <Link
          href={`/admissoes/${item.admissionId}`}
          className="px-2.5 py-1 rounded-lg border border-[#E5EAE0] text-[11.5px] text-wg-ink-muted hover:bg-[#F5F7F3] transition-colors"
        >
          Ficha
        </Link>
      </div>
    </div>
  );
}

function AdmissionCard({
  group, todayStr, urgency,
}: { group: AdmissionGroup; todayStr: string; urgency: "overdue" | "today" | "upcoming" }) {
  const { admission, sections } = group;
  const companyInfo = [admission.companyName, admission.branchName].filter(Boolean).join(" · ");

  return (
    <div className="bg-[#FAFBF8] border border-[#E8EDE2] rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14.5px] font-bold text-wg-ink">{admission.fullName}</span>
            {admission.positionName && (
              <span className="text-[12px] text-wg-ink-muted">{admission.positionName}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {companyInfo && <span className="text-[11.5px] text-wg-ink-muted">{companyInfo}</span>}
            <StartDateBadge startDate={admission.startDate} todayStr={todayStr} />
          </div>
        </div>
        {admission.checklistTotal > 0 && (
          <div className="w-32 shrink-0 pt-0.5">
            <ProgressBar done={admission.checklistDone} total={admission.checklistTotal} />
            <div className="text-[10.5px] text-wg-ink-muted mt-0.5 text-right">
              {admission.checklistDone}/{admission.checklistTotal} tarefas
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#E8EDE2]">
        {sections.map(sec => (
          <div key={sec.sectionName}>
            <div className="px-4 pt-2 pb-0.5">
              <span className="text-[10.5px] font-semibold text-wg-ink-muted uppercase tracking-wide">
                {sec.sectionName}
              </span>
            </div>
            <div className="px-4 pb-2">
              {sec.items.map(item => (
                <ActivityRow key={item.id} item={item} todayStr={todayStr} urgency={urgency} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UrgencySection({
  label, color, bgColor, dotColor, groups, todayStr, urgency, count,
}: {
  label: string; color: string; bgColor: string; dotColor: string;
  groups: AdmissionGroup[]; todayStr: string;
  urgency: "overdue" | "today" | "upcoming"; count: number;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
        <span className="text-[13px] font-bold" style={{ color }}>{label}</span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: bgColor, color }}>
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {groups.map(g => (
          <AdmissionCard key={g.admission.id} group={g} todayStr={todayStr} urgency={urgency} />
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default async function AdmissaoAtividadesWidget() {
  const data = await fetchWidgetData();

  const overdueGroups  = groupByAdmission(data.overdue);
  const todayGroups    = groupByAdmission(data.today);
  const upcomingGroups = groupByAdmission(data.upcoming);
  const totalPending   = data.overdueCount + data.todayCount + data.upcoming.length;
  const isEmpty        = totalPending === 0 && data.todayDone === 0;

  return (
    <div className="bg-white border border-wg-border-lighter rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[15px]">📋</span>
          <span className="text-wg-ink text-base font-bold font-sora">Atividades de Admissão</span>
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
            {data.overdueCount} atrasada{data.overdueCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FCF1DD]">
          <span className="w-2 h-2 rounded-full bg-[#A0721E] shrink-0" />
          <span className="text-[12.5px] font-semibold text-[#A0721E]">
            {data.todayCount} hoje
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EAF4DC]">
          <span className="w-2 h-2 rounded-full bg-[#4F6930] shrink-0" />
          <span className="text-[12.5px] font-semibold text-[#4F6930]">
            {data.todayDone} concluída{data.todayDone !== 1 ? "s" : ""} hoje
          </span>
        </div>
      </div>

      {/* Content */}
      {isEmpty ? (
        <p className="text-wg-ink-muted text-sm py-8 text-center">
          Nenhuma atividade pendente nos próximos 3 dias. 🎉
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <UrgencySection
            label="Atrasadas" color="#C0392B" bgColor="#FDECEA" dotColor="#C0392B"
            groups={overdueGroups} todayStr={data.todayStr} urgency="overdue"
            count={data.overdueCount}
          />
          <UrgencySection
            label="Hoje" color="#A0721E" bgColor="#FCF1DD" dotColor="#D97706"
            groups={todayGroups} todayStr={data.todayStr} urgency="today"
            count={data.todayCount}
          />
          <UrgencySection
            label="Próximos 3 dias" color="#3C56A8" bgColor="#E9EDFA" dotColor="#3B82F6"
            groups={upcomingGroups} todayStr={data.todayStr} urgency="upcoming"
            count={data.upcoming.length}
          />
        </div>
      )}
    </div>
  );
}
