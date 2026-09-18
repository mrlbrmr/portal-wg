import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/internal/PageHeader";
import { JobRequestsExplorer } from "@/components/internal/JobRequestsExplorer";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import type { JobRequestRow } from "@/types/job-requests";
import type { FormFieldConfig } from "@/types/form-config";
import type { JobPriority, JobRequestStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Solicitações de Vaga — RH" };

interface RequestRecord {
  id: string;
  status: JobRequestStatus;
  title: string | null;
  requester_name: string | null;
  requester_email: string | null;
  reason: string | null;
  location: string | null;
  openings: number | null;
  priority: JobPriority;
  desired_start_date: string | null;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  job_id: string | null;
  form_data: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export default async function SolicitacoesPage() {
  const [session, supabase] = await Promise.all([auth(), createClient()]);
  const canManage = session?.user.role === "ADMIN_RH";

  const [requestsRes, configRes] = await Promise.all([
    supabase
      .from("job_requests")
      .select(
        "id, status, title, requester_name, requester_email, reason, location, openings, priority, desired_start_date, decision_note, decided_by, decided_at, job_id, form_data, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("job_request_form_config")
      .select("fields")
      .eq("id", "singleton")
      .maybeSingle(),
  ]);

  const records = (requestsRes.data ?? []) as RequestRecord[];

  // Vagas já criadas a partir destas requisições — para o link "ver vaga criada".
  const jobIds = records.map((r) => r.job_id).filter((id): id is string => Boolean(id));
  const jobsById = new Map<string, { title: string; status: string }>();
  if (jobIds.length > 0) {
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, title, status")
      .in("id", jobIds);
    for (const j of (jobs ?? []) as Array<{ id: string; title: string; status: string }>) {
      jobsById.set(j.id, { title: j.title, status: j.status });
    }
  }

  const requests: JobRequestRow[] = records.map((r) => {
    const job = r.job_id ? jobsById.get(r.job_id) : undefined;
    return {
      id: r.id,
      status: r.status,
      title: r.title,
      requesterName: r.requester_name,
      requesterEmail: r.requester_email,
      reason: r.reason,
      location: r.location,
      openings: r.openings,
      priority: r.priority ?? "MEDIUM",
      desiredStartDate: r.desired_start_date,
      decisionNote: r.decision_note,
      decidedBy: r.decided_by,
      decidedAt: r.decided_at,
      jobId: r.job_id,
      jobTitle: job?.title ?? null,
      jobStatus: job?.status ?? null,
      formData: r.form_data ?? {},
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });

  const configFields = Array.isArray(configRes.data?.fields)
    ? (configRes.data.fields as FormFieldConfig[])
    : DEFAULT_FORM_CONFIG.fields;
  const fieldLabels = configFields.map((f) => ({ key: f.key, label: f.label }));

  return (
    <div className="bg-slate-50">
      <PageHeader
        title="Solicitações de vaga"
        subtitle="Requisições enviadas pelos gestores. A vaga só é criada após sua aprovação."
      />
      <JobRequestsExplorer
        requests={requests}
        fieldLabels={fieldLabels}
        canManage={canManage}
      />
    </div>
  );
}
