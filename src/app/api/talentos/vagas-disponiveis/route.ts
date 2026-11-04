import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTalentoWrite } from "@/lib/talentos/permissions";
import { entryStagesFor } from "@/lib/talentos/crm";
import { ACTIVE_JOB_STATUSES, JOB_STATUS_LABELS } from "@/lib/utils";
import { loadAllJobStageRefs, loadDefaultTemplateRefs } from "@/lib/selection-funnel/process-data";
import { resolveJobStages } from "@/lib/selection-funnel/process-templates";
import { canonicalJobStatus } from "@/lib/recruitment/job-presentation";

// Opções do "Adicionar à vaga": vagas em andamento (mesma regra de ACTIVE_JOB_STATUSES,
// sem as vagas-banco legadas) e, para cada uma, as etapas de ENTRADA do seu funil.
export async function GET() {
  const access = await requireTalentoWrite();
  if (!access.ok) return NextResponse.json({ error: "Não autorizado" }, { status: access.status });

  const supabase = await createClient();
  const [{ data: jobs, error }, { data: stages }, byJob, defaultRefs] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, code, city, state, status")
      .in("status", [...ACTIVE_JOB_STATUSES])
      .eq("isTalentPool", false)
      .order("createdAt", { ascending: false }),
    supabase
      .from("application_stages")
      .select("id, name, kind, hideFromBoard, sortOrder, active")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
    loadAllJobStageRefs(supabase),
    loadDefaultTemplateRefs(supabase),
  ]);
  if (error) return NextResponse.json({ error: "Não foi possível carregar as vagas." }, { status: 500 });

  const allStages = (stages ?? []) as Array<{ id: string; name: string; kind: string; hideFromBoard: boolean; sortOrder: number; active: boolean }>;

  return NextResponse.json({
    jobs: ((jobs ?? []) as Array<{ id: string; title: string; code: string | null; city: string | null; state: string | null; status: string }>).map((j) => {
      const jobStages = resolveJobStages(allStages, byJob.get(j.id), defaultRefs).stages;
      return {
        id: j.id,
        title: j.title,
        code: j.code,
        location: [j.city, j.state].filter(Boolean).join(" — ") || null,
        statusLabel: JOB_STATUS_LABELS[canonicalJobStatus(j.status)] ?? j.status,
        stages: entryStagesFor(jobStages).map((s) => ({ id: s.id, name: s.name })),
      };
    }),
  });
}
