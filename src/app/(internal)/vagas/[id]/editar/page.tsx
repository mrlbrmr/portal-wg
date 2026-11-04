import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job, JobPublication } from "@/types/domain";
import { redirect, notFound } from "next/navigation";
import type { PublicationView } from "@/components/internal/DistributionPanel";
import { buildAnnouncementText, jobPublicUrl } from "@/lib/distribution/dispatch";
import { JobWorkspace } from "@/components/internal/job/JobWorkspace";
import { isJobTab } from "@/lib/jobs/tabs";
import type { PipelineData, PipelineStageCount } from "@/components/internal/job/JobPanels";
import type { HireCandidate } from "@/components/internal/job/JobPositionsCard";
import type { JobPosition } from "@/lib/jobs/positions";
import type { JobEventRow, StatusHistoryRow } from "@/lib/jobs/history";
import { pipelineGroup, type PipelineGroup } from "@/lib/recruitment/candidate-presentation";
import { loadJobTemplates } from "@/lib/jobs/template-data";
import { loadDefaultTemplateRefs, loadProcessTemplates } from "@/lib/selection-funnel/process-data";
import { resolveJobStages } from "@/lib/selection-funnel/process-templates";
import { buildJobInterviewItems, type JobInterviewRow } from "@/lib/recruitment/interviews/job-items";
import type { Metadata } from "next";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("title").eq("id", id).single();
  return { title: data?.title ? `${data.title} — Vaga — RH` : "Vaga — RH" };
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

type StageRow = { id: string; name: string; color: string; kind: string; hideFromBoard: boolean | null; sortOrder: number; active: boolean };
type OriginRow = { id: string; code: string | null; requester_name: string | null; status: string } | null;

/**
 * Página de gestão da vaga (processo seletivo): abas Visão geral · Descrição · Processo
 * seletivo · Divulgação · Histórico. Tudo é carregado em UMA rodada de consultas paralelas
 * (sem N+1): a vaga com histórico/publicações/solicitação embutidos, as posições, os
 * eventos, as etapas e só `id, stageId, fullName` das candidaturas (para os contadores).
 */
export default async function EditarVagaPage({ params, searchParams }: Props) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const [jobRes, positionsRes, eventsRes, appsRes, stagesRes, stageConfigRes, defaultStageRefs, templates, processTemplates, interviewsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "*, statusHistory:job_status_history(id, status, changedBy, changedAt), publications:job_publications(*), origin:job_requests!jobs_requestId_fkey(id, code, requester_name, status)"
      )
      .eq("id", id)
      .limit(20, { referencedTable: "job_publications" })
      .maybeSingle(),
    supabase
      .from("job_positions")
      .select(
        "id, positionNumber, status, applicationId, admissionId, candidateName, expectedStartDate, filledAt, filledBy, cancelledAt, cancelledBy, cancelReason"
      )
      .eq("jobId", id)
      .order("positionNumber", { ascending: true }),
    supabase
      .from("job_events")
      .select("id, type, positionId, reason, data, actorName, createdAt")
      .eq("jobId", id)
      .order("createdAt", { ascending: false })
      .limit(300),
    supabase.from("applications").select("id, stageId, fullName").eq("jobId", id),
    supabase
      .from("application_stages")
      .select("id, name, color, kind, hideFromBoard, sortOrder, active")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
    supabase.from("job_stage_config").select("stageId, sortOrder").eq("jobId", id),
    loadDefaultTemplateRefs(supabase),
    loadJobTemplates(),
    loadProcessTemplates(supabase),
    supabase
      .from("application_interviews")
      .select(
        'id, "applicationId", round, "scheduledAt", "durationMin", "interviewerName", location, application:applications!inner(id, fullName, jobId)'
      )
      .eq("application.jobId", id)
      .eq("status", "SCHEDULED")
      .order("scheduledAt", { ascending: true })
      .limit(50),
  ]);

  const jobRaw = jobRes.data as unknown as
    | (Job & {
        statusHistory: StatusHistoryRow[];
        publications: (Omit<JobPublication, "postedAt"> & { postedAt: string | null })[];
        origin: OriginRow;
      })
    | null;
  if (!jobRaw) notFound();
  const { statusHistory, publications: pubs, origin: originRow, ...job } = jobRaw;

  const positions = (positionsRes.data ?? []) as JobPosition[];
  const events = (eventsRes.data ?? []) as JobEventRow[];
  const apps = (appsRes.data ?? []) as Array<{ id: string; stageId: string; fullName: string }>;

  // Etapas: o ajuste da vaga (job_stage_config), senão o modelo padrão, senão todo o catálogo.
  const allStages = (stagesRes.data ?? []) as StageRow[];
  const resolvedStages = resolveJobStages(
    allStages,
    (stageConfigRes.data ?? []) as Array<{ stageId: string; sortOrder: number }>,
    defaultStageRefs
  );
  const jobStages = resolvedStages.stages;
  const flow = jobStages.map((s) => ({ ...s, hideFromBoard: s.hideFromBoard ?? false }));
  const stageById = new Map(allStages.map((s) => [s.id, s]));

  const countByStage = new Map<string, number>();
  for (const a of apps) countByStage.set(a.stageId, (countByStage.get(a.stageId) ?? 0) + 1);

  const groups: Record<PipelineGroup, number> = { NEW: 0, IN_PROCESS: 0, FINALIST: 0, CLOSED: 0 };
  for (const a of apps) {
    const s = stageById.get(a.stageId);
    groups[pipelineGroup(s ? { ...s, hideFromBoard: s.hideFromBoard ?? false } : undefined, flow)]++;
  }
  const stages: PipelineStageCount[] = flow.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    kind: s.kind,
    hidden: s.hideFromBoard,
    count: countByStage.get(s.id) ?? 0,
  }));
  // "Em entrevistas" só quando o funil tem etapas de entrevista (pelo nome configurado).
  const interviewStageIds = flow.filter((s) => /entrevista/i.test(s.name) && s.kind !== "LOST").map((s) => s.id);
  const pipeline: PipelineData = {
    total: apps.length,
    groups,
    stages,
    process: {
      catalog: allStages.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind })),
      currentStageIds: jobStages.map((s) => s.id),
      isCustom: resolvedStages.source === "JOB",
      templateId: (job as { processTemplateId?: string | null }).processTemplateId ?? null,
      templates: processTemplates
        .filter((t) => t.active)
        .map((t) => ({ id: t.id, name: t.name, isDefault: t.isDefault, stageIds: t.stageIds })),
      counts: Object.fromEntries(countByStage),
    },
    interviewCount: interviewStageIds.length
      ? interviewStageIds.reduce((n, sid) => n + (countByStage.get(sid) ?? 0), 0)
      : null,
  };

  // Quem pode ser vinculado manualmente a uma posição: candidatos em etapa de
  // admissão/contratado que ainda não ocupam posição desta vaga.
  const occupied = new Set(positions.filter((p) => p.status === "FILLED" && p.applicationId).map((p) => p.applicationId));
  const hireCandidates: HireCandidate[] = apps
    .filter((a) => {
      const k = stageById.get(a.stageId)?.kind;
      return (k === "ADMISSION" || k === "WON") && !occupied.has(a.id);
    })
    .map((a) => ({ applicationId: a.id, fullName: a.fullName, stageName: stageById.get(a.stageId)?.name ?? "" }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));

  const interviews = buildJobInterviewItems((interviewsRes.data ?? []) as unknown as JobInterviewRow[], new Date());

  const publications: PublicationView[] = pubs.map((p) => ({
    channel: p.channel,
    status: p.status,
    externalUrl: p.externalUrl,
    lastError: p.lastError,
    postedAt: p.postedAt ?? null,
  }));

  const announcementText = buildAnnouncementText({
    id: job.id,
    title: job.title,
    slug: job.slug,
    city: job.city,
    state: job.state,
    department: job.department,
    company: job.company,
    contractType: job.contractType,
    salaryRange: job.salaryRange,
    highlightBenefit: job.highlightBenefit,
    url: jobPublicUrl(job.slug ?? job.id),
  });

  return (
    <JobWorkspace
      key={job.id}
      initialTab={isJobTab(tab) ? tab : "visao"}
      data={{
        job: job as Job,
        positions,
        events,
        statusHistory,
        publications,
        origin: originRow
          ? { id: originRow.id, code: originRow.code, requesterName: originRow.requester_name, status: originRow.status }
          : null,
        pipeline,
        hireCandidates,
        interviews,
        announcementText,
        jobUrl: jobPublicUrl(job.slug ?? job.id),
        templates,
      }}
    />
  );
}

