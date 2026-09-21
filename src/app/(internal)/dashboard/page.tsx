import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  FlaskConical,
  Hourglass,
  Inbox,
  Plus,
  Send,
  UserCheck,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { loadJobRows } from "@/lib/recruitment/job-rows";
import { loadAdmissionRows, admissionFlags, daysUntilStart } from "@/lib/admissao/overview";
import {
  jobAttentionReasons,
  operationalSituation,
  attentionScore,
  ATTENTION_RULES,
  SITUATION_META,
} from "@/lib/recruitment/attention";
import { jobLifecycle } from "@/lib/recruitment/job-presentation";
import { formatRelativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/internal/PageHeader";
import { DashboardCard } from "@/components/internal/DashboardCard";
import { ButtonLink } from "@/components/ui/Button";
import { Panel, panelLinkClass } from "@/components/ui/Panel";
import { ActionListItem } from "@/components/ui/ActionListItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, StageBadge, TONE_TEXT } from "@/components/ui/StatusBadge";

export const metadata: Metadata = { title: "Visão geral — RH" };

type QueueItem = {
  key: string;
  href: string;
  icon: typeof Inbox;
  tone: "success" | "info" | "warning" | "danger" | "neutral";
  count: number;
  title: string;
  description?: string;
};

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [session, admissions, jobs, recentAppsRes, requestsRes, reviewRes, waitingTestsRes] = await Promise.all([
    auth(),
    getAdmissionConfig().then((config) => loadAdmissionRows(supabase, config)),
    loadJobRows(supabase, { limit: 500 }),
    supabase
      .from("applications")
      .select("id, fullName, createdAt, jobId, job:jobs(title), stage:application_stages(name, color)")
      .order("createdAt", { ascending: false })
      .limit(6),
    supabase.from("job_requests").select("status").in("status", ["PENDING_HR", "PENDING_APPROVAL", "RETURNED"]),
    supabase.from("assessment_sessions").select("id", { count: "exact", head: true }).eq("outcome", "PENDING_REVIEW"),
    supabase
      .from("assessment_sessions")
      .select("id", { count: "exact", head: true })
      .is("submittedAt", null)
      .or(`expiresAt.is.null,expiresAt.gt.${nowIso}`),
  ]);

  const firstName = session?.user.name?.split(" ")[0] ?? "";
  const isAdmin = session?.user.role === "ADMIN_RH";
  const now = new Date();

  // ── Recrutamento ───────────────────────────────────────────────────────────
  const openJobs = jobs.filter((j) => !j.isTalentPool && jobLifecycle(j.status) === "OPEN");
  const candidatesInProcess = openJobs.reduce((acc, j) => acc + j.candidateCount, 0);
  const awaitingTriage = openJobs.reduce((acc, j) => acc + j.newCount, 0);
  const jobsWithNew = openJobs.filter((j) => j.newCount > 0);

  const attention = openJobs
    .map((j) => ({ job: j, reasons: jobAttentionReasons(j, now) }))
    .filter((x) => x.reasons.length > 0)
    .sort((a, b) => attentionScore(b.reasons) - attentionScore(a.reasons));
  const staleJobs = attention.filter((x) => x.reasons.some((r) => r.key === "STALE")).length;
  const closingJobs = attention.filter((x) =>
    x.reasons.some((r) => r.key === "CLOSING_SOON" || r.key === "CLOSING_PASSED")
  ).length;

  const requestStatuses = ((requestsRes.data ?? []) as Array<{ status: string }>).map((r) => r.status);
  const pendingHr = requestStatuses.filter((s) => s === "PENDING_HR").length;
  const pendingApproval = requestStatuses.filter((s) => s === "PENDING_APPROVAL").length;
  const returned = requestStatuses.filter((s) => s === "RETURNED").length;
  const reviewTests = reviewRes.count ?? 0;
  const waitingTests = waitingTestsRes.count ?? 0;

  // ── Admissões ──────────────────────────────────────────────────────────────
  const openAdmissions = admissions.filter((a) => !a.isFinal);
  const flags = openAdmissions.map((a) => ({ a, f: admissionFlags(a, now) }));
  const missingDocs = flags.filter((x) => x.f.missingDocs).length;
  const lateAdmissions = flags.filter((x) => x.f.late).length;
  const upcoming = flags
    .filter((x) => x.f.upcoming)
    .map((x) => x.a)
    .sort((a, b) => (a.startDateISO ?? "").localeCompare(b.startDateISO ?? ""));
  const waitingForm = flags.filter((x) => x.f.waitingForm).length;
  const admissionsWithIssues = flags.filter((x) => x.f.missingDocs || x.f.late || x.f.waitingForm).length;

  // ── Fila de trabalho (só itens com algo a fazer) ───────────────────────────
  const recruitmentQueue: QueueItem[] = [
    awaitingTriage > 0 && {
      key: "triagem",
      href:
        jobsWithNew.length === 1
          ? `/vagas/${jobsWithNew[0].id}/candidatos`
          : "/vagas/gerenciar?pendencia=triagem",
      icon: UserCheck,
      tone: "warning" as const,
      count: awaitingTriage,
      title: plural(awaitingTriage, "candidatura aguardando triagem", "candidaturas aguardando triagem"),
      description:
        jobsWithNew.length === 1
          ? jobsWithNew[0].title
          : `Em ${jobsWithNew.length} ${plural(jobsWithNew.length, "vaga", "vagas")}`,
    },
    pendingHr > 0 && {
      key: "rh",
      href: "/solicitacoes?status=PENDING_HR",
      icon: Inbox,
      tone: "warning" as const,
      count: pendingHr,
      title: plural(pendingHr, "solicitação de vaga para validar", "solicitações de vaga para validar"),
      description: "Pedidos dos gestores aguardando o RH",
    },
    reviewTests > 0 && {
      key: "avaliacoes",
      href: "/avaliacoes/resultados",
      icon: FlaskConical,
      tone: "info" as const,
      count: reviewTests,
      title: plural(reviewTests, "avaliação aguardando revisão", "avaliações aguardando revisão"),
      description: "Testes respondidos que precisam de correção manual",
    },
    staleJobs > 0 && {
      key: "paradas",
      href: "/vagas/gerenciar?pendencia=atencao",
      icon: Hourglass,
      tone: "danger" as const,
      count: staleJobs,
      title: plural(staleJobs, "vaga sem movimentação", "vagas sem movimentação"),
      description: `Nenhuma atividade há ${ATTENTION_RULES.staleDays} dias ou mais`,
    },
    closingJobs > 0 && {
      key: "encerrando",
      href: "/vagas/gerenciar?pendencia=atencao",
      icon: CalendarClock,
      tone: "warning" as const,
      count: closingJobs,
      title: plural(closingJobs, "vaga com prazo de inscrição próximo ou vencido", "vagas com prazo de inscrição próximo ou vencido"),
    },
  ].filter(Boolean) as QueueItem[];

  const admissionQueue: QueueItem[] = [
    lateAdmissions > 0 && {
      key: "atrasadas",
      href: "/admissoes?filtro=atrasadas",
      icon: CalendarX,
      tone: "danger" as const,
      count: lateAdmissions,
      title: plural(lateAdmissions, "admissão com início vencido", "admissões com início vencido"),
      description: "A data de início passou e a admissão não foi concluída",
    },
    missingDocs > 0 && {
      key: "docs",
      href: "/admissoes?filtro=documentos",
      icon: FileWarning,
      tone: "warning" as const,
      count: missingDocs,
      title: plural(missingDocs, "admissão com documentos obrigatórios pendentes", "admissões com documentos obrigatórios pendentes"),
    },
    upcoming.length > 0 && {
      key: "proximas",
      href: "/admissoes?filtro=proximas",
      icon: CalendarClock,
      tone: "info" as const,
      count: upcoming.length,
      title: plural(upcoming.length, "admissão começa nos próximos 7 dias", "admissões começam nos próximos 7 dias"),
    },
  ].filter(Boolean) as QueueItem[];

  const waitingOthersQueue: QueueItem[] = [
    pendingApproval > 0 && {
      key: "aprovacao",
      href: "/solicitacoes?status=PENDING_APPROVAL",
      icon: Hourglass,
      tone: "neutral" as const,
      count: pendingApproval,
      title: plural(pendingApproval, "solicitação aguardando aprovação do gestor", "solicitações aguardando aprovação do gestor"),
    },
    returned > 0 && {
      key: "devolvidas",
      href: "/solicitacoes?status=RETURNED",
      icon: Inbox,
      tone: "neutral" as const,
      count: returned,
      title: plural(returned, "solicitação devolvida aguardando ajuste do gestor", "solicitações devolvidas aguardando ajuste do gestor"),
    },
    waitingForm > 0 && {
      key: "formulario",
      href: "/admissoes?filtro=formulario",
      icon: Send,
      tone: "neutral" as const,
      count: waitingForm,
      title: plural(waitingForm, "formulário admissional aguardando o candidato", "formulários admissionais aguardando o candidato"),
    },
    waitingTests > 0 && {
      key: "testes",
      href: "/avaliacoes/resultados",
      icon: FlaskConical,
      tone: "neutral" as const,
      count: waitingTests,
      title: plural(waitingTests, "teste enviado aguardando o candidato", "testes enviados aguardando o candidato"),
    },
  ].filter(Boolean) as QueueItem[];

  const queueGroups = [
    { title: "Recrutamento", items: recruitmentQueue },
    { title: "Admissões", items: admissionQueue },
    { title: "Aguardando outras pessoas", items: waitingOthersQueue },
  ].filter((g) => g.items.length > 0);
  const myActions = [...recruitmentQueue, ...admissionQueue].reduce((acc, i) => acc + i.count, 0);

  const recentApplications = (recentAppsRes.data ?? []) as unknown as Array<{
    id: string;
    fullName: string;
    createdAt: string;
    jobId: string;
    job: { title: string } | null;
    stage: { name: string; color: string } | null;
  }>;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Visão geral"
        subtitle={
          <>
            Olá{firstName ? `, ${firstName}` : ""}.{" "}
            {myActions > 0
              ? `Há ${myActions} ${plural(myActions, "item", "itens")} pedindo a sua ação.`
              : "Nenhuma pendência sua no momento."}
          </>
        }
        action={
          isAdmin && (
            <>
              <ButtonLink href="/vagas/gerenciar" variant="secondary" icon={Briefcase}>
                Gerenciar vagas
              </ButtonLink>
              <ButtonLink href="/vagas/nova" variant="primary" icon={Plus}>
                Nova vaga
              </ButtonLink>
            </>
          )
        }
      />

      {/* Métricas compactas — contexto, não o foco da tela */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <DashboardCard icon={Briefcase} tone="success" value={openJobs.length} label="Vagas abertas" href="/vagas/gerenciar?status=OPEN" />
        <DashboardCard icon={Users} tone="info" value={candidatesInProcess} label="Candidatos em processo" hint="Nas vagas abertas, sem descartados" />
        <DashboardCard
          icon={UserCheck}
          tone={awaitingTriage > 0 ? "warning" : "neutral"}
          value={awaitingTriage}
          label="Aguardando triagem"
          href="/vagas/gerenciar?pendencia=triagem"
        />
        <DashboardCard
          icon={Inbox}
          tone={pendingHr + pendingApproval > 0 ? "warning" : "neutral"}
          value={pendingHr + pendingApproval}
          label="Solicitações em análise"
          href="/solicitacoes"
        />
        <DashboardCard
          icon={ClipboardCheck}
          tone={admissionsWithIssues > 0 ? "warning" : "neutral"}
          value={openAdmissions.length}
          label="Admissões em andamento"
          hint={admissionsWithIssues > 0 ? `${admissionsWithIssues} com pendências` : "Nenhuma com pendência"}
          href="/admissoes"
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Fila de trabalho */}
        <Panel
          id="fila"
          title="Sua fila de trabalho"
          description="O que precisa de ação agora. Cada item abre a tela já filtrada."
        >
          {queueGroups.length === 0 ? (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="Tudo em dia"
              description="Não há candidaturas para triar, solicitações para validar nem admissões com pendência."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {queueGroups.map((g) => (
                <div key={g.title}>
                  <h3 className="mb-1 px-2 font-inter text-label uppercase tracking-wide text-wg-ink-muted">{g.title}</h3>
                  <ul className="flex flex-col">
                    {g.items.map((i) => (
                      <ActionListItem
                        key={i.key}
                        href={i.href}
                        icon={i.icon}
                        tone={i.tone}
                        count={i.count}
                        title={i.title}
                        description={i.description}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Vagas que precisam de atenção — sempre com o motivo */}
        <Panel
          id="atencao"
          title="Vagas que precisam de atenção"
          meta={attention.length > 0 ? `${attention.length} de ${openJobs.length} abertas` : undefined}
          action={
            attention.length > 0 ? (
              <Link href="/vagas/gerenciar?pendencia=atencao" className={panelLinkClass}>
                Ver todas <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : undefined
          }
          flush
        >
          {attention.length === 0 ? (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="Nenhuma vaga precisa de atenção no momento"
              description="Todas as vagas abertas estão com movimentação recente e sem candidatos parados na triagem."
            />
          ) : (
            <ul className="flex flex-col">
              {attention.slice(0, 5).map(({ job, reasons }) => {
                const situation = SITUATION_META[operationalSituation(reasons)];
                const location = job.isTalentPool ? "Todas as praças" : [job.city, job.state].filter(Boolean).join("/");
                return (
                  <li key={job.id} className="border-t border-wg-border-lighter first:border-t-0">
                    <Link
                      href={`/vagas/${job.id}/candidatos`}
                      className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-wg-bg"
                    >
                      <AlertTriangle
                        className={`mt-0.5 h-4 w-4 shrink-0 ${TONE_TEXT[situation.tone]}`}
                        aria-label={`Situação: ${situation.label}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-record-title text-wg-ink">{job.title}</span>
                        {location && <span className="block truncate text-meta text-wg-ink-muted">{location}</span>}
                        <span className="mt-1 flex flex-col gap-0.5">
                          {reasons.map((r) => (
                            <span key={r.key} className={`text-meta font-medium ${TONE_TEXT[r.tone]}`}>
                              {r.label}
                            </span>
                          ))}
                        </span>
                      </span>
                      <StatusBadge tone={situation.tone}>{situation.label}</StatusBadge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Candidaturas recentes */}
        <Panel
          id="candidaturas"
          title="Candidaturas recentes"
          meta={awaitingTriage > 0 ? `${awaitingTriage} aguardando triagem` : undefined}
          action={
            <Link href="/vagas/gerenciar?pendencia=triagem" className={panelLinkClass}>
              Ver vagas <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
          flush
        >
          {recentApplications.length === 0 ? (
            <EmptyState compact icon={Users} title="Nenhuma candidatura recebida ainda" />
          ) : (
            <ul className="flex flex-col">
              {recentApplications.map((app) => (
                <li key={app.id} className="border-t border-wg-border-lighter first:border-t-0">
                  <Link
                    href={`/vagas/${app.jobId}/candidatos`}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-wg-bg"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-body font-medium text-wg-ink">{app.fullName}</span>
                      <span className="block truncate text-meta text-wg-ink-muted">
                        {app.job?.title ?? "Vaga removida"} · <time dateTime={app.createdAt}>{formatRelativeTime(app.createdAt, now)}</time>
                      </span>
                    </span>
                    {app.stage && <StageBadge color={app.stage.color}>{app.stage.name}</StageBadge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Próximas admissões */}
        <Panel
          id="proximas-admissoes"
          title="Próximas admissões"
          meta="próximos 7 dias"
          action={
            <Link href="/admissoes/calendario" className={panelLinkClass}>
              Calendário <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
          flush
        >
          {upcoming.length === 0 ? (
            <EmptyState compact icon={CalendarClock} title="Não há admissões previstas para os próximos 7 dias" />
          ) : (
            <ul className="flex flex-col">
              {upcoming.slice(0, 5).map((a) => {
                const d = daysUntilStart(a.startDateISO!, now);
                const f = admissionFlags(a, now);
                return (
                  <li key={a.id} className="border-t border-wg-border-lighter first:border-t-0">
                    <Link
                      href={`/admissoes/${a.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-wg-bg"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-body font-medium text-wg-ink">{a.fullName}</span>
                        <span className="block truncate text-meta text-wg-ink-muted">
                          {[a.positionName, a.branchName].filter(Boolean).join(" · ") || "Cargo não definido"}
                          {f.missingDocs && (
                            <span className="text-warning-fg">
                              {" "}
                              · {a.requiredDocsTotal - a.requiredDocsDone}{" "}
                              {plural(a.requiredDocsTotal - a.requiredDocsDone, "documento pendente", "documentos pendentes")}
                            </span>
                          )}
                        </span>
                      </span>
                      <StatusBadge tone={d <= 1 ? "warning" : "info"}>
                        {d === 0 ? "Começa hoje" : d === 1 ? "Amanhã" : `Em ${d} dias`}
                      </StatusBadge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-meta text-wg-ink-muted">
        Uma vaga aberta pede atenção quando tem candidatos sem triagem, prazo de inscrição próximo ou vencido, nenhum
        candidato após {ATTENTION_RULES.noCandidatesDays} dias ou nenhuma movimentação há {ATTENTION_RULES.staleDays} dias.
      </p>
    </div>
  );
}
