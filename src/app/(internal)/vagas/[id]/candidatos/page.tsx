import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, Users } from "lucide-react";
import { CandidatePipeline } from "@/components/internal/candidates/CandidatePipeline";
import { JobPipelineActions } from "@/components/internal/candidates/JobPipelineActions";
import type { PipelineCandidate } from "@/components/internal/candidates/types";
import { AddCandidateModal } from "@/components/internal/AddCandidateModal";
import { IncluirTalentoModal } from "@/components/internal/IncluirTalentoModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MODALITY_LABELS } from "@/lib/utils";
import { JOB_LIFECYCLE_META, jobLifecycle } from "@/lib/recruitment/job-presentation";
import { enteredStageAtFromLatest, type TestStatus } from "@/lib/recruitment/candidate-presentation";
import type { CvProfile } from "@/lib/ai/cv-analyzer";
import type { Metadata } from "next";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("title").eq("id", id).single();
  return { title: data?.title ? `${data.title} — Candidatos — RH` : "Candidatos — RH" };
}

interface Props {
  params: Promise<{ id: string }>;
}

type AssessmentRow = { id: string; kind: string; occurredAt: string | null; outcome: string | null };

export default async function CandidatosPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // auth + job em paralelo (independentes entre si)
  const [session, { data: job }] = await Promise.all([
    auth(),
    supabase
      .from("jobs")
      .select("id, code, title, city, state, isTalentPool, requestId, modality, status, responsible")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!job) notFound();

  // applications (com avaliações embutidas) + stages em paralelo
  const [{ data: applications, error: applicationsError }, { data: stagesData }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, fullName, email, phone, resumeName, stageId, source, createdAt, cv_extraction_status, sort_order, candidateCity, candidateState, cv_profile, notes, noteRows:application_notes(id), assessments:application_assessments(id, kind, occurredAt, outcome)"
      )
      .eq("jobId", id)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("createdAt", { ascending: false }),
    supabase
      .from("application_stages")
      .select("id, name, color, kind, templateId, hideFromBoard")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
  ]);

  // Valores derivados da wave 1
  const rawStages = (stagesData ?? []) as Array<{
    id: string; name: string; color: string; kind: string; templateId: string | null; hideFromBoard: boolean;
  }>;
  const testTemplateIds = rawStages
    .filter((s) => s.kind === "TEST" && s.templateId)
    .map((s) => s.templateId as string);
  const hasAdmissionStage = rawStages.some((s) => s.kind === "ADMISSION" || s.kind === "WON");
  const testStageIds = new Set(rawStages.filter((s) => s.kind === "TEST").map((s) => s.id));

  const appList = (applications ?? []) as Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string;
    resumeName: string | null;
    stageId: string;
    source: string;
    createdAt: string;
    cv_extraction_status: string;
    sort_order: number | null;
    candidateCity: string | null;
    candidateState: string | null;
    cv_profile: Partial<CvProfile> | null;
    notes: string | null;
    noteRows: Array<{ id: string }> | null;
    assessments: AssessmentRow[] | null;
  }>;

  const testAppIds = appList.filter((a) => testStageIds.has(a.stageId)).map((a) => a.id);
  const allAppIds = appList.map((a) => a.id);

  // Wave 2: todas as queries restantes em paralelo (dependem apenas da wave 1)
  type TemplateRow = { id: string; name: string; kind: string };
  type MetaItem = { id: string; name: string };
  type SessRow = { applicationId: string; outcome: string | null; submittedAt: string | null };
  type AiRow = { applicationId: string; score: number };
  type HistoryRow = { applicationId: string; stageId: string | null; changedAt: string };

  const [tmplData, stageConfigData, sessData, aiData, historyData, admissionMeta] = await Promise.all([
    testTemplateIds.length > 0
      ? supabase.from("assessment_templates").select("id, name, kind").in("id", testTemplateIds)
          .then((r) => r.data as TemplateRow[] | null)
      : null,
    supabase.from("job_stage_config").select("stageId").eq("jobId", id)
      .then((r) => r.data as Array<{ stageId: string }> | null),
    testAppIds.length > 0
      ? supabase.from("assessment_sessions").select("applicationId, outcome, submittedAt")
          .in("applicationId", testAppIds).order("createdAt", { ascending: false })
          .then((r) => r.data as SessRow[] | null)
      : null,
    allAppIds.length > 0
      ? supabase.from("application_assessments")
          .select("applicationId, score, createdAt")
          .eq("kind", "AI_FIT").in("applicationId", allAppIds)
          .not("score", "is", null).order("createdAt", { ascending: false })
          .then((r) => r.data as AiRow[] | null)
      : null,
    // Entrada na etapa atual: registro mais recente do histórico de cada candidatura.
    allAppIds.length > 0
      ? supabase.from("application_stage_history")
          .select("applicationId, stageId, changedAt")
          .in("applicationId", allAppIds)
          .order("changedAt", { ascending: false })
          .then((r) => r.data as HistoryRow[] | null)
      : null,
    hasAdmissionStage
      ? Promise.all([
          supabase.from("admission_positions").select("id, name").order("sortOrder", { ascending: true }),
          supabase.from("admission_companies").select("id, name").order("sortOrder", { ascending: true }),
          supabase.from("admission_branches").select("id, name").order("sortOrder", { ascending: true }),
          supabase.from("admission_stages").select("id")
            .eq("name", "Envio do formulário admissional").eq("active", true).limit(1).maybeSingle(),
        ]).then(([posR, coR, brR, intakeR]) => ({
          positions: (posR.data ?? []) as MetaItem[],
          companies: (coR.data ?? []) as MetaItem[],
          branches: (brR.data ?? []) as MetaItem[],
          intakeStageId: intakeR.data?.id ?? null,
        }))
      : null,
  ]);

  // templateNames / templateKinds
  const templateNames = new Map<string, string>();
  const templateKinds = new Map<string, string>();
  (tmplData ?? []).forEach((t) => {
    templateNames.set(t.id, t.name);
    templateKinds.set(t.id, t.kind);
  });

  const allStages = rawStages.map((s) => ({
    ...s,
    hideFromBoard: s.hideFromBoard ?? false,
    templateName: s.templateId ? (templateNames.get(s.templateId) ?? null) : null,
    templateKind: s.templateId ? (templateKinds.get(s.templateId) ?? null) : null,
  }));

  const activeStageIds = (stageConfigData ?? []).map((r) => r.stageId);
  const stages =
    activeStageIds.length > 0
      ? allStages.filter((s) => activeStageIds.includes(s.id))
      : allStages;

  // Situação do teste (só para quem está numa etapa TEST), pela sessão mais recente:
  // sem sessão → não enviado; sessão aberta → aguardando; respondida → resultado.
  const testStatusByApp = new Map<string, TestStatus>();
  for (const s of sessData ?? []) {
    if (testStatusByApp.has(s.applicationId)) continue;
    testStatusByApp.set(
      s.applicationId,
      !s.submittedAt
        ? "AWAITING"
        : s.outcome === "PASS" || s.outcome === "FAIL"
        ? s.outcome
        : "PENDING_REVIEW"
    );
  }
  for (const appId of testAppIds) {
    if (!testStatusByApp.has(appId)) testStatusByApp.set(appId, "NOT_SENT");
  }

  // Wave 3: Big Five (depende de templateKinds da wave 2)
  const bigFiveTemplateIds = [...templateKinds.entries()]
    .filter(([, k]) => k === 'PERSONALITY_BIG5')
    .map(([id]) => id);
  const bigFiveDoneSet = new Set<string>();
  if (bigFiveTemplateIds.length > 0 && allAppIds.length > 0) {
    const { data: bfData } = await supabase
      .from('assessment_sessions')
      .select('applicationId')
      .in('templateId', bigFiveTemplateIds)
      .not('submittedAt', 'is', null)
      .in('applicationId', allAppIds);
    (bfData ?? []).forEach((s: { applicationId: string }) => bigFiveDoneSet.add(s.applicationId));
  }

  // aiScoreByApp
  const aiScoreByApp = new Map<string, number>();
  for (const row of (aiData ?? [])) {
    if (!aiScoreByApp.has(row.applicationId)) aiScoreByApp.set(row.applicationId, row.score);
  }

  const latestHistoryByApp = new Map<string, HistoryRow>();
  for (const h of historyData ?? []) {
    if (!latestHistoryByApp.has(h.applicationId)) latestHistoryByApp.set(h.applicationId, h);
  }

  // Entrevistas registradas com data de hoje em diante (datas só-dia ficam em 00h/12h UTC).
  const todayUtc = new Date().toISOString().slice(0, 10);
  const nextInterview = (rows: AssessmentRow[]) =>
    rows
      .filter((r) => r.kind === "INTERVIEW" && r.occurredAt && r.occurredAt.slice(0, 10) >= todayUtc)
      .filter((r) => !r.outcome || r.outcome === "PENDING")
      .map((r) => r.occurredAt as string)
      .sort()[0] ?? null;

  const cards: PipelineCandidate[] = appList.map((a) => {
    const assessments = a.assessments ?? [];
    const profile = a.cv_profile ?? null;
    return {
      id: a.id,
      fullName: a.fullName,
      email: a.email,
      phone: a.phone,
      resumeName: a.resumeName,
      stageId: a.stageId,
      source: a.source,
      createdAt: new Date(a.createdAt).toISOString(),
      sortOrder: a.sort_order ?? undefined,
      aiScore: aiScoreByApp.get(a.id),
      cvExtractionStatus: a.cv_extraction_status ?? undefined,
      bigFiveDone: bigFiveDoneSet.has(a.id),
      // undefined quando não está em etapa TEST → sem badge de teste
      testStatus: testStatusByApp.get(a.id),
      city: a.candidateCity,
      state: a.candidateState,
      lastPosition: profile?.lastPosition?.trim() || null,
      experienceYears: typeof profile?.experienceYears === "number" ? profile.experienceYears : null,
      education: profile?.education?.trim() || null,
      skills: Array.isArray(profile?.skills) ? profile.skills.filter((s): s is string => typeof s === "string") : [],
      hasNotes: !!a.notes?.trim() || (a.noteRows?.length ?? 0) > 0,
      assessmentCount: assessments.filter((r) => r.kind !== "AI_FIT").length,
      enteredStageAt: enteredStageAtFromLatest(latestHistoryByApp.get(a.id), a.stageId),
      nextInterviewAt: nextInterview(assessments),
    };
  });

  // Ordena: sort_order explícito primeiro, depois por aiScore desc (padrão).
  // A filtragem por coluna no Kanban preserva esta ordem relativa.
  cards.sort((a, b) => {
    if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
    if (a.sortOrder != null) return -1;
    if (b.sortOrder != null) return 1;
    return (b.aiScore ?? -1) - (a.aiScore ?? -1);
  });

  const canManage = session?.user.role === "ADMIN_RH";

  // Rastro da autorização: de qual solicitação veio esta vaga. Vagas legadas não têm.
  let originRequest: { id: string; code: string | null } | null = null;
  if (job.requestId) {
    const { data: req } = await supabase
      .from("job_requests")
      .select("id, code")
      .eq("id", job.requestId)
      .maybeSingle();
    if (req) originRequest = req as { id: string; code: string | null };
  }

  const jobLocation = job.isTalentPool
    ? "Banco de talentos"
    : job.city
    ? `${job.city}/${job.state}`
    : "Múltiplas cidades";
  const lifecycle = JOB_LIFECYCLE_META[jobLifecycle(job.status)];
  const meta = [job.code, jobLocation, job.modality ? MODALITY_LABELS[job.modality] ?? job.modality : null].filter(Boolean);

  return (
    <div>
      <Link
        href="/vagas/gerenciar"
        className="-ml-1 mb-3 inline-flex items-center gap-1 rounded-control px-1 py-0.5 text-meta font-medium text-wg-ink-muted transition-colors hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Voltar às vagas
      </Link>

      {/* Header da vaga: quem é a vaga à esquerda, ações à direita (CTA principal por último). */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-sora text-2xl font-semibold tracking-tight text-wg-ink md:text-page-title">{job.title}</h1>
            <StatusBadge tone={lifecycle.tone} hint={lifecycle.hint}>
              {lifecycle.label}
            </StatusBadge>
          </div>
          <p className="mt-1 text-meta text-wg-ink-muted">
            {meta.join(" · ")}
            {job.responsible && <> · Recrutador: <span className="text-wg-ink-secondary">{job.responsible}</span></>}
          </p>
          {originRequest && (
            <p className="mt-0.5 text-meta text-wg-ink-muted">
              Solicitação{" "}
              <Link
                href={`/solicitacoes/${originRequest.id}`}
                className="font-medium text-wg-green-dark hover:underline"
              >
                {originRequest.code ?? "sem número"}
              </Link>
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <IncluirTalentoModal jobId={job.id} />
            <AddCandidateModal jobId={job.id} />
            <JobPipelineActions
              jobId={job.id}
              allStages={allStages.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
              activeStageIds={activeStageIds}
            />
          </div>
        )}
      </header>

      {applicationsError ? (
        <div className="rounded-card border border-danger-border bg-white">
          <EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar as candidaturas"
            description="Houve uma falha ao consultar o banco. Recarregue a página em instantes."
            action={
              <Link href={`/vagas/${job.id}/candidatos`} className="text-meta font-semibold text-wg-green-dark hover:underline">
                Tentar novamente
              </Link>
            }
          />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-card border border-dashed border-wg-border-light bg-white">
          <EmptyState
            icon={Users}
            title="Nenhuma candidatura recebida ainda"
            description={
              canManage
                ? "Quando alguém se inscrever pelo portal, a candidatura aparece aqui. Você também pode cadastrar um candidato ou trazer alguém do banco de talentos."
                : "Quando alguém se inscrever por esta vaga no portal, a candidatura aparece aqui."
            }
          />
        </div>
      ) : (
        <CandidatePipeline
          applications={cards}
          stages={stages}
          canManage={canManage}
          jobId={job.id}
          jobTitle={job.title}
          admissionMeta={admissionMeta}
        />
      )}
    </div>
  );
}
