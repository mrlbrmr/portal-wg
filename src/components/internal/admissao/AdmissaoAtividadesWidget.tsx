import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AdmissaoAtividadesWidgetClient,
  type WidgetData,
  type WidgetAdmission,
  type WidgetItem,
  type Activity,
} from "./AdmissaoAtividadesWidgetClient";

// ─── Helpers (somente para o fetch) ──────────────────────────────────────────

function todayUTCStr(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

function addDaysToStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

const fetchWidgetData = unstable_cache(
  async (): Promise<WidgetData> => {
  const supabase = createAdminClient();
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

  const active = ((admData ?? []) as unknown as RawAdm[]).filter((a) => !a.stage?.isFinal);
  const activeIds = active.map((a) => a.id);

  if (activeIds.length === 0) {
    return {
      overdue: [], today: [], upcoming: [],
      overdueCount: 0, todayCount: 0, todayDone: 0, todayStr,
    };
  }

  const admissionMap = new Map<string, WidgetAdmission>(
    active.map((a) => {
      const topItems = (a.checklistGroups ?? [])
        .flatMap((g) => g.items ?? [])
        .filter((i) => !i.parentId);
      return [
        a.id,
        {
          id: a.id,
          fullName: a.fullName,
          startDate: a.startDate,
          positionName: a.position?.name ?? null,
          companyName: a.company?.name ?? null,
          branchName: a.branch?.name ?? null,
          checklistDone: topItems.filter((i) => i.status === "DONE").length,
          checklistTotal: topItems.length,
        },
      ];
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

  const activities: Activity[] = (
    (itemsRes.data ?? []) as unknown as RawItem[]
  ).flatMap((item) => {
    const admission = admissionMap.get(item.admissionId);
    if (!admission) return [];
    const widgetItem: WidgetItem = {
      id: item.id,
      name: item.name,
      dueDate: item.dueDate,
      admissionId: item.admissionId,
      groupName: item.group?.name ?? "Geral",
    };
    return [{ item: widgetItem, admission }];
  });

  const overdue  = activities.filter((a) => a.item.dueDate < todayStr);
  const today    = activities.filter((a) => a.item.dueDate === todayStr);
  const upcoming = activities.filter((a) => a.item.dueDate > todayStr);

  return {
    overdue, today, upcoming,
    overdueCount: overdue.length,
    todayCount: today.length,
    todayDone: doneRes.count ?? 0,
    todayStr,
  };
  },
  ["admissao-widget"],
  { revalidate: 60, tags: ["admissoes-widget"] }
);

// ─── Export ───────────────────────────────────────────────────────────────────

export default async function AdmissaoAtividadesWidget() {
  const data = await fetchWidgetData();
  return <AdmissaoAtividadesWidgetClient data={data} />;
}
