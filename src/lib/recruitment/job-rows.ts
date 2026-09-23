import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobRow } from "@/types/jobs";

// Carrega as vagas já enriquecidas com o que a operação precisa ver: candidatos ativos,
// candidatos aguardando triagem, data de abertura real e última movimentação.
// Compartilhado por Dashboard e lista de Vagas para que os números batam entre as telas.

const OPEN_STATUSES = new Set(["ACTIVE", "SCREENING", "INTERVIEW", "ADMISSION"]);

type JobDbRow = {
  id: string;
  title: string;
  city: string | null;
  state: string | null;
  isTalentPool: boolean;
  modality: JobRow["modality"];
  contractType: JobRow["contractType"];
  department: string | null;
  openingReason: JobRow["openingReason"];
  responsible: string | null;
  status: JobRow["status"];
  slug: string | null;
  createdAt: string;
  updatedAt: string;
  closingDate: string | null;
  openings: number | null;
  openPositions: number | null;
};

export async function loadJobRows(supabase: SupabaseClient, { limit = 200 } = {}): Promise<JobRow[]> {
  const [jobsRes, appRowsRes, lostStagesRes, historyRes] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, title, city, state, isTalentPool, modality, contractType, department, openingReason, responsible, status, slug, createdAt, updatedAt, closingDate, openings, openPositions"
      )
      .order("createdAt", { ascending: false })
      .limit(limit),
    supabase.from("applications").select("jobId, stageId, updatedAt").limit(5000),
    supabase.from("application_stages").select("id").eq("kind", "LOST"),
    // Histórico de status: abertura = 1ª transição para um status aberto; statusChangedAt =
    // transição mais recente. Sem filtro por id (evita URL gigante) — poucas linhas por vaga.
    supabase
      .from("job_status_history")
      .select("jobId, status, changedAt")
      .order("changedAt", { ascending: false })
      .limit(5000),
  ]);

  const jobs = (jobsRes.data ?? []) as JobDbRow[];

  const openedAtByJob = new Map<string, string>();
  const statusChangedAtByJob = new Map<string, string>();
  for (const h of (historyRes.data ?? []) as Array<{ jobId: string; status: string; changedAt: string }>) {
    if (OPEN_STATUSES.has(h.status)) {
      const prev = openedAtByJob.get(h.jobId);
      if (!prev || h.changedAt < prev) openedAtByJob.set(h.jobId, h.changedAt);
    }
    const prevChange = statusChangedAtByJob.get(h.jobId);
    if (!prevChange || h.changedAt > prevChange) statusChangedAtByJob.set(h.jobId, h.changedAt);
  }

  const lostStageIds = new Set(((lostStagesRes.data ?? []) as Array<{ id: string }>).map((s) => s.id));
  const countByJob = new Map<string, number>();
  const newByJob = new Map<string, number>();
  // Última mudança em qualquer candidatura da vaga (inclui as descartadas — marcar
  // alguém como perdido também conta como atividade na vaga).
  const lastActivityByJob = new Map<string, string>();
  for (const a of (appRowsRes.data ?? []) as Array<{ jobId: string; stageId: string; updatedAt: string }>) {
    if (!lostStageIds.has(a.stageId)) countByJob.set(a.jobId, (countByJob.get(a.jobId) ?? 0) + 1);
    if (a.stageId === "NEW") newByJob.set(a.jobId, (newByJob.get(a.jobId) ?? 0) + 1);
    const prev = lastActivityByJob.get(a.jobId);
    if (!prev || a.updatedAt > prev) lastActivityByJob.set(a.jobId, a.updatedAt);
  }

  const iso = (d: string) => new Date(d).toISOString();

  return jobs.map((job) => {
    const appActivity = lastActivityByJob.get(job.id);
    const lastActivityAt = appActivity && appActivity > job.updatedAt ? appActivity : job.updatedAt;
    return {
      id: job.id,
      title: job.title,
      city: job.city,
      state: job.state,
      isTalentPool: job.isTalentPool,
      modality: job.modality,
      contractType: job.contractType,
      department: job.department,
      openingReason: job.openingReason,
      responsible: job.responsible,
      status: job.status,
      slug: job.slug,
      createdAt: iso(job.createdAt),
      updatedAt: iso(job.updatedAt),
      lastActivityAt: iso(lastActivityAt),
      candidateCount: countByJob.get(job.id) ?? 0,
      newCount: newByJob.get(job.id) ?? 0,
      openedAt: iso(openedAtByJob.get(job.id) ?? job.createdAt),
      statusChangedAt: iso(statusChangedAtByJob.get(job.id) ?? job.updatedAt),
      closingDate: job.closingDate ? iso(job.closingDate) : null,
      // openings/openPositions são mantidos por trigger a partir de job_positions.
      positionsTotal: job.isTalentPool ? null : job.openings ?? null,
      positionsFilled:
        job.isTalentPool || job.openings == null ? null : Math.max(0, job.openings - (job.openPositions ?? job.openings)),
    };
  });
}
