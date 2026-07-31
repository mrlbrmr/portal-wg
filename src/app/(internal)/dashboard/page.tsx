import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PUBLIC_JOB_STATUS_LIST } from "@/lib/job-visibility";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard — RH" };

const STATUS_STRIPE: Record<string, string> = {
  ADMISSION: "#D1503C",
  INTERVIEW:  "#D9873C",
  SCREENING:  "#D9873C",
  ACTIVE:     "#B9C2AA",
  DRAFT:      "#B9C2AA",
  PAUSED:     "#B9C2AA",
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg: "#EAF4DC", color: "#4F6930" },
  SCREENING: { bg: "#FCF1DD", color: "#A0721E" },
  INTERVIEW: { bg: "#EAF4DC", color: "#4F6930" },
  ADMISSION: { bg: "#FCF1DD", color: "#A0721E" },
  DRAFT:     { bg: "#E9EDFA", color: "#3C56A8" },
  PAUSED:    { bg: "#F3F3F3", color: "#777777" },
  CLOSED:    { bg: "#F3F3F3", color: "#777777" },
  FILLED:    { bg: "#E4F3DA", color: "#2F5D1E" },
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa", SCREENING: "Triagem", INTERVIEW: "Entrevistas",
  ADMISSION: "Admissão", DRAFT: "Rascunho", PAUSED: "Pausada",
  CLOSED: "Cancelada", FILLED: "Finalizada",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user.name?.split(" ")[0] ?? "";

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfThisMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfLastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in7UTC   = new Date(todayUTC.getTime() + 7 * 86400000);

  const supabase = await createClient();
  const publicStatuses = PUBLIC_JOB_STATUS_LIST as readonly string[];

  const [
    activeJobsRes, draftJobsRes, pausedJobsRes, closedJobsRes, filledJobsRes,
    thisMonthRes, lastMonthRes,
    newAppsRes, totalAppsRes,
    recentApplicationsRes,
    attentionJobsRes,
    newAppsByJobRes,
    expiringSoonRes,
  ] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }).in("status", publicStatuses),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "DRAFT"),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "PAUSED"),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "CLOSED"),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "FILLED"),
    supabase.from("jobs").select("*", { count: "exact", head: true })
      .gte("createdAt", startOfThisMonth.toISOString())
      .lt("createdAt", startOfNextMonth.toISOString()),
    supabase.from("jobs").select("*", { count: "exact", head: true })
      .gte("createdAt", startOfLastMonth.toISOString())
      .lt("createdAt", startOfThisMonth.toISOString()),
    supabase.from("applications").select("*", { count: "exact", head: true }).eq("stageId", "NEW"),
    supabase.from("applications").select("*", { count: "exact", head: true }),
    supabase.from("applications")
      .select("id, fullName, createdAt, jobId, job:jobs(title), stage:application_stages(name, color)")
      .order("createdAt", { ascending: false })
      .limit(5),
    supabase.from("jobs")
      .select("id, title, status, city, state")
      .in("status", [...publicStatuses, "DRAFT"])
      .order("createdAt", { ascending: false })
      .limit(8),
    supabase.from("applications").select("jobId").eq("stageId", "NEW"),
    supabase.from("jobs").select("*", { count: "exact", head: true })
      .in("status", publicStatuses)
      .gte("closingDate", now.toISOString())
      .lte("closingDate", sevenDaysFromNow.toISOString()),
  ]);

  const activeJobs   = activeJobsRes.count   ?? 0;
  const draftJobs    = draftJobsRes.count    ?? 0;
  const pausedJobs   = pausedJobsRes.count   ?? 0;
  const closedJobs   = closedJobsRes.count   ?? 0;
  const filledJobs   = filledJobsRes.count   ?? 0;
  const thisMonth    = thisMonthRes.count     ?? 0;
  const lastMonth    = lastMonthRes.count     ?? 0;
  const newApps      = newAppsRes.count       ?? 0;
  const totalApps    = totalAppsRes.count     ?? 0;
  const expiringSoon = expiringSoonRes.count  ?? 0;

  const monthDiff  = thisMonth - lastMonth;
  const monthTrend = monthDiff > 0 ? `+${monthDiff} vs mês anterior`
    : monthDiff < 0 ? `${monthDiff} vs mês anterior`
    : "igual ao mês anterior";

  // New applications per job → used in "Vagas que Precisam de Atenção"
  const countByJob: Record<string, number> = {};
  for (const row of (newAppsByJobRes.data ?? [])) {
    countByJob[row.jobId] = (countByJob[row.jobId] ?? 0) + 1;
  }

  const attentionJobs = ((attentionJobsRes.data ?? []) as Array<{
    id: string; title: string; status: string; city: string; state: string;
  }>)
    .filter((j) => (countByJob[j.id] ?? 0) > 0 || ["ADMISSION", "INTERVIEW", "SCREENING"].includes(j.status))
    .sort((a, b) => (countByJob[b.id] ?? 0) - (countByJob[a.id] ?? 0))
    .slice(0, 4);

  const recentApplications = (recentApplicationsRes.data ?? []) as unknown as Array<{
    id: string; fullName: string; createdAt: string; jobId: string;
    job: { title: string } | null;
    stage: { name: string; color: string } | null;
  }>;

  const isAdmin = session?.user.role === "ADMIN_RH";

  const KPIS = [
    { icon: "💼", iconBg: "#EAF4DC", value: activeJobs,  label: "Vagas Ativas",    href: "/vagas/gerenciar" },
    { icon: "📄", iconBg: "#E9EDFA", value: draftJobs,   label: "Rascunhos",       href: "/vagas/gerenciar?status=DRAFT" },
    { icon: "⏸",  iconBg: "#FCF1DD", value: pausedJobs,  label: "Vagas Pausadas",  href: "/vagas/gerenciar?status=PAUSED" },
    { icon: "⊗",  iconBg: "#EFEFEF", value: closedJobs,  label: "Vagas Canceladas",href: "/vagas/gerenciar?status=CLOSED" },
    { icon: "✓",  iconBg: "#EAF4DC", value: filledJobs,  label: "Vagas Finalizadas",href: "/vagas/gerenciar?status=FILLED" },
  ];

  return (
    <div className="px-8 py-8 md:px-11 md:py-9 flex flex-col gap-6">

      {/* Header */}
      <div>
        <h1 className="text-wg-ink text-[28px] font-extrabold tracking-tight font-sora">
          Olá, {firstName} 👋
        </h1>
        <p className="text-wg-ink-secondary text-[14.5px] mt-1.5">
          Você tem <strong>{newApps} novas candidaturas</strong> aguardando triagem
          {expiringSoon > 0 && (
            <> e <strong>{expiringSoon} {expiringSoon === 1 ? "vaga encerrando" : "vagas encerrando"}</strong> nos próximos 7 dias</>
          )}.
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-6 gap-3.5">
        {KPIS.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="block bg-white border border-wg-border-lighter rounded-2xl p-4 hover:shadow-[0_6px_16px_rgba(0,0,0,.06)] hover:-translate-y-0.5 transition"
          >
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center text-[15px] mb-2.5"
              style={{ background: k.iconBg }}
            >
              {k.icon}
            </div>
            <div className="text-wg-ink text-2xl font-extrabold font-sora tabular-nums">{k.value}</div>
            <div className="text-wg-ink-muted text-[12.5px] mt-0.5 font-inter">{k.label}</div>
            <div className="text-wg-green-dark text-[11px] font-bold mt-1.5">Ver detalhes →</div>
          </Link>
        ))}

        {/* Publicadas este mês + sparkline */}
        <div className="bg-white border border-wg-border-lighter rounded-2xl p-4">
          <div className="flex justify-between items-start">
            <div className="text-wg-ink text-2xl font-extrabold font-sora tabular-nums">{thisMonth}</div>
            <svg width="56" height="24" viewBox="0 0 56 24" className="shrink-0">
              <polyline
                points="0,18 10,15 20,17 30,10 40,8 56,2"
                fill="none" stroke="#90CB46" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-wg-ink-muted text-[12.5px] mt-0.5">Publicadas este mês</div>
          <div className={`text-[11px] font-bold mt-1 ${monthDiff >= 0 ? "text-wg-green-dark" : "text-red-600"}`}>
            {monthTrend}
          </div>
        </div>
      </div>

      {/* Dois painéis: candidaturas + vagas atenção */}
      <div className="grid gap-5 items-start" style={{ gridTemplateColumns: "1.3fr 1fr" }}>

        {/* Candidaturas Recentes */}
        <div className="bg-white border border-wg-border-lighter rounded-2xl p-5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px]">👥</span>
              <span className="text-wg-ink text-base font-bold font-sora">Candidaturas Recentes</span>
              <span className="text-[#6B7860] text-[13px]">{totalApps} no total</span>
              {newApps > 0 && (
                <span className="bg-[#EAF4DC] text-wg-green-dark text-[11.5px] font-bold px-2 py-0.5 rounded-full">
                  {newApps} nova{newApps > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <Link href="/vagas/gerenciar" className="text-wg-green-dark text-[13px] font-semibold">
              Ver todas →
            </Link>
          </div>

          <div className="flex flex-col">
            {recentApplications.length === 0 ? (
              <p className="text-wg-ink-muted text-sm py-6 text-center">Nenhuma candidatura ainda.</p>
            ) : (
              recentApplications.map((app) => (
                <Link
                  key={app.id}
                  href={`/vagas/${app.jobId}/candidatos`}
                  className="group flex items-center justify-between gap-3 py-3 px-1 border-t border-[#F0F3EC] relative"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-wg-ink text-[14.5px] font-bold truncate">{app.fullName}</div>
                    <div className="text-wg-ink-muted text-[12.5px] mt-0.5 truncate group-hover:opacity-0 transition-opacity">
                      {app.job?.title} · {timeAgo(app.createdAt)}
                    </div>
                    <div className="absolute left-1 bottom-2.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                      <span className="bg-[#F0F5E8] text-[#3E5A2A] px-2.5 py-1 rounded-lg text-xs font-semibold">
                        Ver Perfil
                      </span>
                    </div>
                  </div>
                  {app.stage && (
                    <span
                      className="text-[11.5px] font-bold px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: `${app.stage.color}1f`, color: app.stage.color }}
                    >
                      {app.stage.name}
                    </span>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Vagas que Precisam de Atenção */}
        <div className="bg-white border border-wg-border-lighter rounded-2xl p-5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <span className="text-wg-ink text-base font-bold font-sora">Vagas que Precisam de Atenção</span>
            <Link href="/vagas/gerenciar" className="text-wg-green-dark text-[13px] font-semibold">
              Ver todas →
            </Link>
          </div>

          <div className="flex flex-col">
            {attentionJobs.length === 0 ? (
              <p className="text-wg-ink-muted text-sm py-6 text-center">Nenhuma vaga precisando de atenção.</p>
            ) : (
              attentionJobs.map((vaga) => {
                const badge  = STATUS_BADGE[vaga.status]  ?? { bg: "#F3F3F3", color: "#777" };
                const stripe = STATUS_STRIPE[vaga.status] ?? "#B9C2AA";
                const pendentes = countByJob[vaga.id] ?? 0;
                return (
                  <Link
                    key={vaga.id}
                    href={`/vagas/${vaga.id}/candidatos`}
                    className="group flex items-center justify-between gap-2.5 py-2.5 px-1 border-t border-[#F0F3EC] relative"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-1 h-6 rounded shrink-0"
                        style={{ background: stripe }}
                      />
                      <div className="min-w-0">
                        <div className="text-wg-ink text-[13.5px] font-bold truncate">{vaga.title}</div>
                        <div className="text-wg-ink-muted text-xs mt-0.5 group-hover:opacity-0 transition-opacity">
                          {[vaga.city, vaga.state].filter(Boolean).join("/") || "—"}
                        </div>
                        <div className="absolute left-3 bottom-2.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                          <span className="bg-[#F0F5E8] text-[#3E5A2A] px-2.5 py-1 rounded-lg text-xs font-semibold">
                            Ir para a vaga
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {pendentes > 0 && (
                        <span className="bg-[#F0F5E8] text-[#3E5A2A] text-[11px] font-bold px-2 py-0.5 rounded-full">
                          👥 {pendentes} {pendentes === 1 ? "novo" : "novos"}
                        </span>
                      )}
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-md"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {STATUS_LABEL[vaga.status]?.toUpperCase() ?? vaga.status}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* CTAs */}
      {isAdmin && (
        <div className="flex gap-3">
          <Link
            href="/vagas/nova"
            className="flex-1 bg-wg-green text-wg-dark py-4 rounded-xl text-[15px] font-bold text-center hover:bg-wg-green-vivid transition-colors"
          >
            + Nova Vaga
          </Link>
          <Link
            href="/vagas/gerenciar"
            className="flex-1 bg-white text-wg-ink-secondary border border-wg-border-light py-4 rounded-xl text-[15px] font-bold text-center hover:bg-wg-bg transition-colors"
          >
            💼 Gerenciar Vagas
          </Link>
        </div>
      )}
    </div>
  );
}
