import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoWrite } from "@/lib/talentos/permissions";
import { entryStagesFor } from "@/lib/talentos/crm";
import { ACTIVE_JOB_STATUSES, JOB_STATUS_LABELS } from "@/lib/utils";

// Opções do "Adicionar à vaga": vagas em andamento (mesma regra de ACTIVE_JOB_STATUSES,
// sem as vagas-banco legadas) e, para cada uma, as etapas de ENTRADA do seu funil.
export async function GET() {
  const access = await requireTalentoWrite();
  if (!access.ok) return NextResponse.json({ error: "Não autorizado" }, { status: access.status });

  const supabase = await createClient();
  const [{ data: jobs, error }, { data: stages }, { data: config }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, code, city, state, status")
      .in("status", [...ACTIVE_JOB_STATUSES])
      .eq("isTalentPool", false)
      .order("createdAt", { ascending: false }),
    supabase
      .from("application_stages")
      .select("id, name, kind, hideFromBoard, sortOrder")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
    supabase.from("job_stage_config").select("jobId, stageId"),
  ]);
  if (error) return NextResponse.json({ error: "Não foi possível carregar as vagas." }, { status: 500 });

  const allStages = (stages ?? []) as Array<{ id: string; name: string; kind: string; hideFromBoard: boolean }>;
  const byJob = new Map<string, Set<string>>();
  for (const r of (config ?? []) as Array<{ jobId: string; stageId: string }>) {
    byJob.set(r.jobId, (byJob.get(r.jobId) ?? new Set()).add(r.stageId));
  }

  return NextResponse.json({
    jobs: ((jobs ?? []) as Array<{ id: string; title: string; code: string | null; city: string | null; state: string | null; status: string }>).map((j) => {
      const configured = byJob.get(j.id);
      const jobStages = configured && configured.size > 0 ? allStages.filter((s) => configured.has(s.id)) : allStages;
      return {
        id: j.id,
        title: j.title,
        code: j.code,
        location: [j.city, j.state].filter(Boolean).join(" — ") || null,
        statusLabel: JOB_STATUS_LABELS[j.status] ?? j.status,
        stages: entryStagesFor(jobStages).map((s) => ({ id: s.id, name: s.name })),
      };
    }),
  });
}
