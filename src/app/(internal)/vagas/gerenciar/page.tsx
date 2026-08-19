import { createClient } from "@/lib/supabase/server";
import { auth } from "@/lib/auth";
import { Plus } from "lucide-react";
import { ExportCsvButton } from "@/components/internal/ExportCsvButton";
import { JobsExplorer } from "@/components/internal/JobsExplorer";
import { PageHeader } from "@/components/internal/PageHeader";
import { PrimaryActionLink } from "@/components/internal/PrimaryActionLink";
import type { JobRow } from "@/types/jobs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gerenciar Vagas — RH" };

export default async function GerenciarVagasPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; status?: string; view?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const canManage = session?.user.role === "ADMIN_RH";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const supabase = await createClient();

  const [jobsRes, appRowsRes, lostStagesRes] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, title, city, state, isTalentPool, modality, contractType, department, responsible, status, priority, slug, createdAt, updatedAt"
      )
      .order("createdAt", { ascending: false })
      .limit(200),
    supabase.from("applications").select("jobId, stageId, updatedAt").limit(5000),
    supabase.from("application_stages").select("id").eq("kind", "LOST"),
  ]);

  const jobs = (jobsRes.data ?? []) as Array<{
    id: string;
    title: string;
    city: string | null;
    state: string | null;
    isTalentPool: boolean;
    modality: string;
    contractType: string;
    department: string | null;
    responsible: string | null;
    status: string;
    priority: string;
    slug: string | null;
    createdAt: string;
    updatedAt: string;
  }>;

  const lostStageIds = new Set(
    ((lostStagesRes.data ?? []) as Array<{ id: string }>).map((s) => s.id)
  );
  const countByJob = new Map<string, number>();
  // Última mudança em qualquer candidatura da vaga (inclui as descartadas —
  // marcar alguém como perdido também conta como atividade na vaga).
  const lastActivityByJob = new Map<string, string>();
  for (const a of (appRowsRes.data ?? []) as Array<{
    jobId: string;
    stageId: string;
    updatedAt: string;
  }>) {
    if (!lostStageIds.has(a.stageId)) {
      countByJob.set(a.jobId, (countByJob.get(a.jobId) ?? 0) + 1);
    }
    const prevActivity = lastActivityByJob.get(a.jobId);
    if (!prevActivity || a.updatedAt > prevActivity) {
      lastActivityByJob.set(a.jobId, a.updatedAt);
    }
  }

  // KPI counts from the loaded jobs array
  const activeCount = jobs.filter((j) =>
    ["ACTIVE", "SCREENING", "INTERVIEW", "ADMISSION"].includes(j.status)
  ).length;
  const draftCount = jobs.filter((j) => j.status === "DRAFT").length;
  const pausedCount = jobs.filter((j) => j.status === "PAUSED").length;
  const closedCount = jobs.filter((j) => j.status === "CLOSED").length;
  const filledCount = jobs.filter((j) => j.status === "FILLED").length;
  const thisMonthCount = jobs.filter((j) => j.createdAt >= startOfMonth).length;
  const lastMonthCount = jobs.filter(
    (j) => j.createdAt >= startOfLastMonth && j.createdAt < startOfMonth
  ).length;

  const rows = jobs.map((job) => {
    const lastApplicationActivity = lastActivityByJob.get(job.id);
    const lastActivityAt =
      lastApplicationActivity && lastApplicationActivity > job.updatedAt
        ? lastApplicationActivity
        : job.updatedAt;
    return {
      id: job.id,
      title: job.title,
      city: job.city,
      state: job.state,
      isTalentPool: job.isTalentPool,
      modality: job.modality,
      contractType: job.contractType,
      department: job.department,
      responsible: job.responsible,
      status: job.status,
      priority: job.priority,
      slug: job.slug,
      createdAt: new Date(job.createdAt).toISOString(),
      updatedAt: new Date(job.updatedAt).toISOString(),
      lastActivityAt: new Date(lastActivityAt).toISOString(),
      candidateCount: countByJob.get(job.id) ?? 0,
    };
  }) as JobRow[];

  const initialView = params.view === "kanban" ? "kanban" : "list";

  const kpiCards = [
    { emoji: "💼", iconBg: "#EAF4DC", value: activeCount, label: "Vagas Ativas" },
    { emoji: "📄", iconBg: "#E9EDFA", value: draftCount, label: "Rascunhos" },
    { emoji: "⏸", iconBg: "#FCF1DD", value: pausedCount, label: "Pausadas" },
    { emoji: "⊗", iconBg: "#EFEFEF", value: closedCount, label: "Canceladas" },
    { emoji: "✓", iconBg: "#EAF4DC", value: filledCount, label: "Finalizadas" },
  ];

  return (
    <div>
      <PageHeader
        title="Vagas"
        action={
          <>
            <ExportCsvButton status={params.status} />
            {canManage && (
              <PrimaryActionLink href="/vagas/nova" icon={Plus}>
                Nova vaga
              </PrimaryActionLink>
            )}
          </>
        }
      />

      {/* KPI Grid */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((k) => (
          <div
            key={k.label}
            className="bg-white border border-[#E7EEDD] rounded-2xl p-4 hover:shadow-[0_6px_16px_rgba(0,0,0,.06)] hover:-translate-y-0.5 transition-all cursor-default"
          >
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center text-[15px] mb-2.5"
              style={{ background: k.iconBg }}
            >
              {k.emoji}
            </div>
            <div className="text-[#1A2213] text-2xl font-extrabold">{k.value}</div>
            <div className="text-[#55614A] text-[12.5px] mt-0.5">{k.label}</div>
          </div>
        ))}

        {/* Sparkline card */}
        <div className="bg-white border border-[#E7EEDD] rounded-2xl p-4">
          <div className="flex justify-between items-start">
            <div className="text-[#1A2213] text-2xl font-extrabold">{thisMonthCount}</div>
            <svg width="56" height="24" viewBox="0 0 56 24" className="shrink-0">
              <polyline
                points="0,18 10,15 20,17 30,10 40,8 56,2"
                fill="none"
                stroke="#90CB46"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-[#55614A] text-[12.5px] mt-0.5">Publicadas este mês</div>
          {lastMonthCount > 0 && (
            <div className="text-[#4F6930] text-[11px] font-bold mt-1">
              {thisMonthCount >= lastMonthCount ? "+" : ""}
              {thisMonthCount - lastMonthCount} vs mês anterior
            </div>
          )}
        </div>
      </div>

      <JobsExplorer
        jobs={rows}
        canManage={canManage}
        initialView={initialView}
        initialStatus={params.status ?? ""}
        initialSort={params.sort ?? "date_desc"}
        currentUserName={(session?.user as { name?: string | null } | undefined)?.name ?? null}
      />
    </div>
  );
}
